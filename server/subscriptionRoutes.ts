import { Router } from "express";
import Stripe from "stripe";
import { isAuthenticated } from "./supabaseAuth";
import {
  subscriptionService,
  STRIPE_PRICE_MAP,
} from "./subscriptionService";

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20",
});

router.get("/", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const data = await subscriptionService.getSubscriptionDetails(userId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar subscrição" });
  }
});

router.post("/create-checkout", isAuthenticated, async (req, res) => {
  try {
    const { plan, billingPeriod } = req.body;

    const currency =
      req.user.currency ||
      req.headers["x-currency"] ||
      "EUR";

    const priceId =
      STRIPE_PRICE_MAP[plan]?.[billingPeriod]?.[currency];

    if (!priceId) {
      return res.status(400).json({ error: "Preço não configurado" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/subscription?success=true`,
      cancel_url: `${process.env.APP_URL}/subscription?canceled=true`,
      customer_email: req.user.email,
      metadata: {
        userId: req.user.id,
        plan,
        billingPeriod,
        currency,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar checkout" });
  }
});

router.post("/cancel", isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await subscriptionService.cancelSubscription(userId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Erro ao cancelar subscrição" });
  }
});

export default router;
