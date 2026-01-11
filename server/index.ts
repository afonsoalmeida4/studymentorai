import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { subscriptionService } from "./subscriptionService";
import Stripe from "stripe";


const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

app.use(
  express.json({
    limit: "50mb",
    verify: (req: any, _res, buf) => {
      // 🔑 Necessário para o Stripe webhook
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

app.post("/api/webhooks/stripe", async (req: any, res) => {
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan as "pro" | "premium" | undefined;

        if (!userId || !plan || !session.subscription) break;

        // ❗ NÃO buscar subscription aqui
        // ❗ NÃO usar current_period_start aqui

        await subscriptionService.updateSubscriptionPlan(
          userId,
          plan,
          {
            customerId: session.customer as string,
            subscriptionId: session.subscription as string,
            status: "active",
            // Clear any previous scheduled cancellation when a new checkout completes
            cancelAtPeriodEnd: false,
          }
        );

        break;
      }


      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription & {
          current_period_start: number;
          current_period_end: number;
          cancel_at_period_end: boolean;
        };


        const userId = sub.metadata?.userId;
        const plan = sub.metadata?.plan as "pro" | "premium" | undefined;

        if (!userId || !plan) break;

        await subscriptionService.updateSubscriptionPlan(
          userId,
          plan,
          {
            subscriptionId: sub.id,
            priceId: sub.items.data[0]?.price.id,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          }
        );

        break;
      }


      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        // If there's a pending plan for this user (scheduled downgrade), create
        // the new subscription now using the stored priceId so we never leave
        // the customer without a single active paid subscription.
        const pending = await subscriptionService.getPendingPlan(userId);
        if (pending && pending.priceId) {
          try {
            const newSub = await stripe.subscriptions.create({
              customer: sub.customer as string,
              items: [{ price: pending.priceId }],
              metadata: { userId, plan: pending.plan, billingPeriod: pending.billingPeriod },
            });

            await subscriptionService.updateSubscriptionPlan(userId, pending.plan as any, {
              status: "active",
              cancelAtPeriodEnd: false,
              subscriptionId: newSub.id,
              priceId: pending.priceId,
              customerId: sub.customer as string,
              currentPeriodStart: new Date(((newSub as any).current_period_start || 0) * 1000),
              currentPeriodEnd: new Date(((newSub as any).current_period_end || 0) * 1000),
            });

            await subscriptionService.clearPendingPlan(userId);
            break;
          } catch (err) {
            console.error("Failed to apply pending plan after subscription deleted:", err);
            // Fallback to marking free so the DB remains consistent
          }
        }

        await subscriptionService.updateSubscriptionPlan(userId, "free", {
          status: "canceled",
          cancelAtPeriodEnd: false,
          subscriptionId: null,
          priceId: null,
        });

        break;
      }

    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});


// Debug logger for ALL requests
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  if (req.url.includes('/api/')) {
    console.log(`[REQUEST HEADERS]`, req.headers);
    console.log(`[REQUEST QUERY]`, req.query);
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
