import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import Stripe from "stripe";
import { subscriptionService } from "./subscriptionService";


const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}



const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

app.use(express.json({
  limit: "50mb",
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  },
}));

app.post("/api/webhooks/stripe", async (req: any, res) => {
  const sig = req.headers["stripe-signature"];

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody, // 👈 MUITO IMPORTANTE
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("❌ Stripe webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("✅ STRIPE EVENT RECEIVED:", event.type);

  try {
    switch (event.type) {

      // =============================
      // CHECKOUT COMPLETED
      // =============================
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        const subscriptionId = session.subscription as string | null;

        if (!userId || !plan || !subscriptionId) {
          console.log("❌ Missing metadata or subscription");
          break;
        }

        // 🔑 Copiar metadata para a subscription
        await stripe.subscriptions.update(subscriptionId, {
          metadata: { userId, plan },
        });

        // Ativar plano SEM datas (ainda)
        await subscriptionService.updateSubscriptionPlan(
          userId,
          plan as any,
          {
            customerId: session.customer as string,
            subscriptionId,
            priceId: undefined,
            currentPeriodStart: undefined,
            currentPeriodEnd: undefined,
          }
        );

        console.log("✅ PLAN ACTIVATED (dates pending)");
        break;
      }

      // =============================
      // SUBSCRIPTION UPDATED
      // =============================
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const userId = subscription.metadata?.userId;
        const plan = subscription.metadata?.plan;

        if (!userId || !plan) break;

        const start = (subscription as any).current_period_start;
        const end = (subscription as any).current_period_end;

        await subscriptionService.updateSubscriptionPlan(
          userId,
          plan as any,
          {
            currentPeriodStart: start ? new Date(start * 1000) : undefined,
            currentPeriodEnd: end ? new Date(end * 1000) : undefined,
          }
        );

        console.log("✅ SUBSCRIPTION DATES UPDATED");
        break;
      }

      // =============================
      // SUBSCRIPTION DELETED
      // =============================
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (userId) {
          await subscriptionService.updateSubscriptionPlan(userId, "free");
          console.log("🧹 SUBSCRIPTION CANCELED → FREE");
        }
        break;
      }

      default:
        console.log("ℹ️ Event ignored:", event.type);
    }

    res.json({ received: true });

  } catch (error) {
    console.error("🔥 Error handling webhook:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});



app.use(express.urlencoded({ extended: false, limit: '50mb' }));

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
