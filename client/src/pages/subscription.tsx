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
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { usePricing } from "@/hooks/usePricing";

type SubscriptionDetails = {
  subscription: Subscription;
  usage: UsageTracking;
  limits: typeof planLimits[SubscriptionPlan];
};

const dateLocaleStringMap: Record<string, string> = {
  pt: "pt-PT",
  "pt-PT": "pt-PT",
  en: "en-US",
  "en-US": "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
};

function getDateLocale(language: string): string {
  return dateLocaleStringMap[language] || "pt-PT";
}

export default function SubscriptionPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const dateLocale = useMemo(() => getDateLocale(i18n.language), [i18n.language]);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const { pricing, loading: pricingLoading } = usePricing();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast({
        title: t("subscription.toasts.paymentSuccess"),
        description: t("subscription.toasts.paymentSuccessMessage"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      window.history.replaceState({}, "", "/subscription");
    }
    if (params.get("canceled") === "true") {
      toast({
        title: t("subscription.toasts.paymentCanceled"),
        description: t("subscription.toasts.paymentCanceledMessage"),
      });
      window.history.replaceState({}, "", "/subscription");
    }
  }, []);

  const { data, isLoading } = useQuery<SubscriptionDetails>({
    queryKey: ["/api/subscription"],
  });

  const createCheckoutMutation = useMutation({
    mutationFn: async (plan: string) => {
      return apiRequest("POST", "/api/subscription/create-checkout", {
        plan,
        billingPeriod,
      });
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/subscription/cancel", {}),
    onSuccess: () => {
      toast({
        title: t("subscription.toasts.cancelSuccess"),
        description: t("subscription.toasts.cancelSuccessMessage"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
    },
  });

  if (isLoading || pricingLoading) {
    return (
      <div className="container max-w-6xl mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || !pricing) return null;

  const currentPlan = data.subscription.plan as SubscriptionPlan;
  const usage = data.usage;
  const limits = data.limits;

  const getDisplayPrice = (planId: string) => {
    if (planId === "free") return null;
    const plan = pricing.plans[planId as "pro" | "premium"];
    const value = billingPeriod === "monthly" ? plan.monthly : plan.yearly;
    return `${pricing.symbol}${value}`;
  };

  const plans = [
    { id: "free", icon: Zap },
    { id: "pro", icon: Crown, popular: true },
    { id: "premium", icon: Rocket },
  ];

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setBillingPeriod(billingPeriod === "monthly" ? "yearly" : "monthly")
          }
        >
          {billingPeriod === "monthly"
            ? t("subscription.billing.monthly")
            : t("subscription.billing.yearly")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = plan.id === currentPlan;

          return (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className="h-6 w-6" />
                  <CardTitle>{t(`subscription.plans.${plan.id}.name`)}</CardTitle>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold">
                    {plan.id === "free"
                      ? t("subscription.free")
                      : getDisplayPrice(plan.id)}
                  </span>
                  {plan.id !== "free" && (
                    <span className="text-muted-foreground">
                      /
                      {billingPeriod === "monthly"
                        ? t("subscription.billing.month")
                        : t("subscription.billing.year")}
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-2">
                  {(planLimits[plan.id as SubscriptionPlan] || []).map(
                    (feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary" />
                        <span>
                          {t(`subscription.plans.${plan.id}.features.${feature}`)}
                        </span>
                      </li>
                    )
                  )}
                </ul>
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
                    className="w-full"
                    onClick={() => createCheckoutMutation.mutate(plan.id)}
                  >
                    {t("subscription.upgrade")}
                    <ArrowRight className="h-4 w-4 ml-2" />
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

