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

        console.log(`[WEBHOOK] Received checkout.session.completed`);
        console.log(`[WEBHOOK] Session ID: ${session.id}`);
        console.log(`[WEBHOOK] Metadata:`, session.metadata);
        console.log(`[WEBHOOK] Subscription ID: ${session.subscription}`);
        console.log(`[WEBHOOK] Customer ID: ${session.customer}`);

        if (!userId || !plan || !session.subscription) {
          console.error(`[WEBHOOK] Missing required data - userId: ${userId}, plan: ${plan}, subscription: ${session.subscription}`);
          break;
        }

        // Fetch existing subscription first so we can cancel it after the new
        // subscription is activated. This ensures a user never has two active
        // Stripe subscriptions at the same time (avoids double billing).
        const existing = await subscriptionService.getUserSubscription(userId);
        const oldSubId = existing?.stripeSubscriptionId;

        console.log(`[WEBHOOK] checkout.session.completed for user ${userId}, plan ${plan}`);
        console.log(`[WEBHOOK] Old subscription ID: ${oldSubId}`);
        console.log(`[WEBHOOK] New subscription ID: ${session.subscription}`);

        // CRITICAL: Cancel the old subscription BEFORE updating to the new one.
        // This prevents any billing issues and ensures clean transition.
        // Only cancel if there's an old subscription and it's different from the new one.
        const newSubId = session.subscription as string;
        if (oldSubId && oldSubId !== newSubId) {
          console.log(`[WEBHOOK] Cancelling old subscription ${oldSubId} before activating new plan`);
          try {
            await stripe.subscriptions.cancel(oldSubId, {
              prorate: true, // Credit any unused time
            });
            console.log(`[WEBHOOK] Successfully cancelled previous subscription ${oldSubId}`);
          } catch (err: any) {
            // Log but don't fail the webhook — we need to activate the new plan.
            console.error(`[WEBHOOK] Failed to cancel old subscription ${oldSubId}:`, err?.message || err);
          }
        }

        // Now activate the new subscription plan
        console.log(`[WEBHOOK] Activating new plan ${plan} for user ${userId}`);
        const updatedSub = await subscriptionService.updateSubscriptionPlan(
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
        
        console.log(`[WEBHOOK] Successfully updated subscription:`, {
          userId: updatedSub.userId,
          plan: updatedSub.plan,
          status: updatedSub.status,
          stripeSubscriptionId: updatedSub.stripeSubscriptionId,
        });

        // Clear any pending plan since checkout completed successfully
        try {
          await subscriptionService.clearPendingPlan(userId);
        } catch (err) {
          console.warn("Could not clear pending plan:", err);
        }

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

        // If there's a pending plan for this user (scheduled downgrade), we
        // considered creating the new subscription here. That automatic creation
        // could be triggered by other flows (like a deletion) and inadvertently
        // create a paid subscription without Checkout. To be safe, only apply
        // a pending plan automatically if it represents a downgrade relative
        // to the deleted subscription's metadata.plan. This preserves the
        // intended scheduled-downgrade behavior while preventing accidental
        // immediate upgrades.
        const pending = await subscriptionService.getPendingPlan(userId);
        if (pending && pending.priceId) {
          try {
            const planRank: Record<string, number> = { free: 0, pro: 1, premium: 2 };
            const deletedPlan = (sub.metadata && (sub.metadata.plan as string)) || null;
            const pendingRank = planRank[pending.plan as string] ?? -1;
            const deletedRank = deletedPlan ? (planRank[deletedPlan] ?? -1) : -1;

            // Only auto-create the pending subscription if it's a true downgrade
            // (pending plan rank < deleted subscription rank). Otherwise skip
            // automatic creation and let Checkout/webhook handle upgrades.
            if (deletedRank >= 0 && pendingRank >= 0 && pendingRank < deletedRank) {
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
            }
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
