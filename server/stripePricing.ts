import geoip from "geoip-lite";
import type { Request } from "express";

type Currency = "EUR" | "USD" | "BRL" | "INR";
type Plan = "pro" | "premium";
type Billing = "monthly" | "yearly";

export function getCurrencyFromRequest(req: Request): Currency {
  try {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      req.socket.remoteAddress;

    if (!ip) return "USD";

    const geo = geoip.lookup(ip);
    if (!geo?.country) return "USD";

    if (geo.country === "BR") return "BRL";
    if (geo.country === "IN") return "INR";

    const euroCountries = [
      "PT","ES","FR","DE","IT","NL","BE","AT","IE","FI","GR","LU","MT","CY","SK","SI","EE","LV","LT"
    ];

    if (euroCountries.includes(geo.country)) return "EUR";

    return "USD";
  } catch {
    return "USD";
  }
}

export function getStripePriceId(
  plan: Plan,
  billing: Billing,
  currency: Currency
): string {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${currency}_${billing === "monthly" ? "MONTH" : "YEAR"}`;
  const priceId = process.env[key];

  if (!priceId) {
    throw new Error(`Stripe price não configurado: ${key}`);
  }

  return priceId;
}
