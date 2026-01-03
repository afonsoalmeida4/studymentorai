import { useEffect, useState } from "react";

type PricingResponse = {
  currency: string;
  symbol: string;
  plans: {
    pro: { monthly: number; yearly: number };
    premium: { monthly: number; yearly: number };
  };
};

export function usePricing() {
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pricing")
      .then(res => res.json())
      .then(data => setPricing(data))
      .finally(() => setLoading(false));
  }, []);

  return { pricing, loading };
}
