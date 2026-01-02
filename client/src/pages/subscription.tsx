import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Crown, Zap, Rocket, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import type { Subscription, UsageTracking, SubscriptionPlan } from "@shared/schema";
import { planLimits } from "@shared/schema";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

/* ---------------- TYPES ---------------- */

type PriceInfo = {
  amount: number;
  currency: "EUR" | "USD" | "BRL" | "INR";
};

type SubscriptionDetails = {
  subscription: Subscription;
  usage: UsageTracking;
  limits: typeof planLimits[SubscriptionPlan];
  prices: {
    pro?: {
      monthly?: PriceInfo;
      yearly?: PriceInfo;
    };
    premium?: {
      monthly?: PriceInfo;
      yearly?: PriceInfo;
    };
  };
};

/* ---------------- HELPERS ---------------- */

const currencySymbols: Record<string, string> = {
  EUR: "€",
  USD: "$",
  BRL: "R$",
  INR: "₹",
};

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "monthly"
  );

  /* ---------------- DATA ---------------- */

  const { data, isLoading } = useQuery<SubscriptionDetails>({
    queryKey: ["/api/subscription"],
  });

  const createCheckoutMutation = useMutation({
    mutationFn: async (plan: "pro" | "premium") => {
      return apiRequest("POST", "/api/subscription/create-checkout", {
        plan,
        billingPeriod,
      });
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível iniciar o checkout.",
          variant: "destructive",
        });
      }
    },
  });

  if (isLoading || !data) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <Skeleton className="h-12 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  const { subscription, usage, limits, prices } = data;
  const currentPlan = subscription.plan as SubscriptionPlan;

  /* ---------------- PRICING ---------------- */

  const getPriceLabel = (plan: "pro" | "premium") => {
    const price = prices?.[plan]?.[billingPeriod];
    if (!price) return "—";

    const symbol = currencySymbols[price.currency];
    return `${symbol}${price.amount}`;
  };

  /* ---------------- UI ---------------- */

  const plans = [
    {
      id: "free",
      icon: Zap,
      color: "text-muted-foreground",
    },
    {
      id: "pro",
      icon: Crown,
      color: "text-blue-600",
      popular: true,
    },
    {
      id: "premium",
      icon: Rocket,
      color: "text-purple-600",
    },
  ] as const;

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-10">
      {/* HEADER */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">{t("subscription.title")}</h1>
        <p className="text-muted-foreground">
          {t("subscription.subtitle")}
        </p>

        {/* BILLING TOGGLE */}
        <div className="flex items-center justify-center gap-3">
          <span
            className={billingPeriod === "monthly" ? "font-bold" : ""}
          >
            Mensal
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setBillingPeriod(
                billingPeriod === "monthly" ? "yearly" : "monthly"
              )
            }
            className="h-8 w-14 p-0 relative"
          >
            <div
              className={`absolute h-6 w-6 bg-primary rounded-full transition-all ${
                billingPeriod === "yearly" ? "left-7" : "left-1"
              }`}
            />
          </Button>
          <span
            className={billingPeriod === "yearly" ? "font-bold" : ""}
          >
            Anual
          </span>
        </div>
      </div>

      {/* PLANS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = plan.id === currentPlan;

          return (
            <Card key={plan.id} className={isCurrent ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className={`h-6 w-6 ${plan.color}`} />
                  <CardTitle>
                    {t(`subscription.plans.${plan.id}.name`)}
                  </CardTitle>
                </div>

                <div className="mt-4 text-3xl font-bold">
                  {plan.id === "free"
                    ? t("subscription.free")
                    : getPriceLabel(plan.id)}
                  {plan.id !== "free" && (
                    <span className="text-base text-muted-foreground">
                      /{billingPeriod === "monthly" ? "mês" : "ano"}
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t(`subscription.plans.${plan.id}.description`)}
                </p>
              </CardContent>

              <CardFooter>
                {isCurrent ? (
                  <Button disabled className="w-full">
                    {t("subscription.active")}
                  </Button>
                ) : plan.id === "free" ? (
                  <Button disabled className="w-full">
                    {t("subscription.free")}
                  </Button>
                ) : (
                  <Button
                    className="w-full gap-2"
                    onClick={() =>
                      createCheckoutMutation.mutate(plan.id)
                    }
                  >
                    {t("subscription.upgrade")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
