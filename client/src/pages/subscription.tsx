import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Crown, Zap, Rocket, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Subscription, UsageTracking, SubscriptionPlan } from "@shared/schema";
import { planLimits } from "@shared/schema";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

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
  "en-GB": "en-GB",
  "en-CA": "en-CA",
  es: "es-ES",
  "es-ES": "es-ES",
  "es-MX": "es-MX",
  fr: "fr-FR",
  "fr-FR": "fr-FR",
  "fr-CA": "fr-CA",
  de: "de-DE",
  "de-DE": "de-DE",
  it: "it-IT",
  "it-IT": "it-IT",
};

function getDateLocale(language: string): string {
  // Try exact match
  if (dateLocaleStringMap[language]) {
    return dateLocaleStringMap[language];
  }
  // Try base language (split on '-')
  const baseLang = language.split('-')[0];
  if (dateLocaleStringMap[baseLang]) {
    return dateLocaleStringMap[baseLang];
  }
  // Default fallback
  return "pt-PT";
}

export default function SubscriptionPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const dateLocale = useMemo(() => getDateLocale(i18n.language), [i18n.language]);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  // Handle Stripe redirect callbacks
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');

    if (success === 'true') {
      toast({
        title: t("subscription.toasts.paymentSuccess"),
        description: t("subscription.toasts.paymentSuccessMessage"),
      });
      // Invalidate subscription query to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      // Clean URL
      window.history.replaceState({}, '', '/subscription');
    } else if (canceled === 'true') {
      toast({
        title: t("subscription.toasts.paymentCanceled"),
        description: t("subscription.toasts.paymentCanceledMessage"),
        variant: "default",
      });
      // Clean URL
      window.history.replaceState({}, '', '/subscription');
    }
  }, [toast]);

  const { data, isLoading } = useQuery<SubscriptionDetails>({
    queryKey: ["/api/subscription"],
  });

  const createCheckoutMutation = useMutation({
    mutationFn: async (plan: string) => {
      return await apiRequest("POST", "/api/subscription/create-checkout", { 
        plan,
        billingPeriod 
      });
    },
    onSuccess: (data) => {
      console.log("Checkout response:", data);
      if (data.url) {
        console.log("Redirecting to:", data.url);
        window.location.href = data.url;
      } else {
        console.error("No URL in response:", data);
        toast({
          title: t("subscription.toasts.checkoutError"),
          description: t("subscription.toasts.noUrl"),
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error("Checkout error:", error);
      toast({
        title: t("subscription.toasts.checkoutError"),
        description: t("subscription.toasts.checkoutErrorMessage"),
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
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

  if (!data) return null;

  const currentPlan = data.subscription.plan as SubscriptionPlan;
  const usage = data.usage;
  const limits = data.limits;

  const uploadPercentage = limits.uploadsPerMonth === -1 
    ? 0 
    : (usage.uploadsCount / limits.uploadsPerMonth) * 100;

  const chatPercentage = limits.dailyChatLimit === -1 
    ? 0 
    : (usage.chatMessagesCount / limits.dailyChatLimit) * 100;

  // Pricing logic: yearly gets ~27% discount
  const pricing = {
    pro: {
      monthly: 5.99,
      yearly: 49.99,
    },
    premium: {
      monthly: 11.99,
      yearly: 99.99,
    },
  };

  const getPrice = (planId: string) => {
    if (planId === "free") return null;
    const plan = pricing[planId as keyof typeof pricing];
    return billingPeriod === "monthly" ? plan.monthly : plan.yearly;
  };

  const getSavings = (planId: string) => {
    if (planId === "free" || billingPeriod === "monthly") return null;
    const plan = pricing[planId as keyof typeof pricing];
    return (plan.monthly * 12 - plan.yearly).toFixed(2);
  };

  const getSavingsPercent = () => {
    // Calculate average savings percentage across both plans
    const proSavings = ((pricing.pro.monthly * 12 - pricing.pro.yearly) / (pricing.pro.monthly * 12)) * 100;
    const premiumSavings = ((pricing.premium.monthly * 12 - pricing.premium.yearly) / (pricing.premium.monthly * 12)) * 100;
    const avgSavings = (proSavings + premiumSavings) / 2;
    return Math.round(avgSavings);
  };

  const plans = [
    {
      id: "free",
      icon: Zap,
      color: "text-muted-foreground",
      featureKeys: ["uploads", "subjects", "topics", "summaries", "learningStyles", "flashcards", "fileSize"],
    },
    {
      id: "pro",
      icon: Crown,
      color: "text-blue-600 dark:text-blue-400",
      popular: true,
      featureKeys: ["uploads", "subjects", "topics", "summaries", "learningStyles", "flashcards", "dashboard", "ranking", "sync"],
    },
    {
      id: "premium",
      icon: Rocket,
      color: "text-purple-600 dark:text-purple-400",
      featureKeys: ["allPro", "tutor", "studyPlans", "mindMaps", "stats", "zenMode", "sharedSpaces", "pdfExport", "earlyAccess"],
    },
  ];

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-8">
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-subscription-title">
            {t("subscription.title")}
          </h1>
          <p className="text-muted-foreground" data-testid="text-subscription-subtitle">
            {t("subscription.subtitle")}
          </p>
        </div>

        {/* Billing Period Toggle */}
        <div className="flex items-center justify-center gap-3">
          <span className={`text-sm font-medium ${billingPeriod === "monthly" ? "text-foreground" : "text-muted-foreground"}`}>
            {t("subscription.billing.monthly")}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "yearly" : "monthly")}
            className="relative h-8 w-14 p-0"
            data-testid="button-billing-toggle"
          >
            <div className={`absolute h-6 w-6 rounded-full bg-primary transition-all ${billingPeriod === "yearly" ? "left-7" : "left-1"}`} />
          </Button>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${billingPeriod === "yearly" ? "text-foreground" : "text-muted-foreground"}`}>
              {t("subscription.billing.yearly")}
            </span>
            {billingPeriod === "yearly" && (
              <Badge variant="default" className="bg-green-600 dark:bg-green-700 text-xs" data-testid="badge-save">
                {t("subscription.billing.save", { percent: getSavingsPercent() })}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {currentPlan === "free" && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle>{t("subscription.currentUsage")}</CardTitle>
            <CardDescription>{t("subscription.currentUsageSubtitle", { planName: t(`subscription.plans.${currentPlan}.name`) })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{t("subscription.uploads")}</span>
                <span className="text-muted-foreground">
                  {usage.uploadsCount} / {limits.uploadsPerMonth}
                </span>
              </div>
              <Progress value={uploadPercentage} data-testid="progress-uploads" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{t("subscription.chatMessages")}</span>
                <span className="text-muted-foreground">
                  {usage.chatMessagesCount} / {limits.dailyChatLimit}
                </span>
              </div>
              <Progress value={chatPercentage} data-testid="progress-chat" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = plan.id === currentPlan;

          return (
            <Card 
              key={plan.id} 
              className={`relative ${isCurrent ? "border-primary shadow-md" : ""}`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.popular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary" data-testid="badge-popular">
                    {t("subscription.popular")}
                  </Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="outline" className="bg-background" data-testid="badge-current">
                    {t("subscription.currentPlan")}
                  </Badge>
                </div>
              )}

              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className={`h-6 w-6 ${plan.color}`} />
                  <CardTitle className="text-lg">{t(`subscription.plans.${plan.id}.name`)}</CardTitle>
                </div>
                <div className="mt-4 space-y-1">
                  <div>
                    <span className="text-3xl font-bold">
                      {plan.id === "free" 
                        ? t("subscription.free") 
                        : `${getPrice(plan.id)}€`
                      }
                    </span>
                    {plan.id !== "free" && (
                      <span className="text-muted-foreground">
                        /{billingPeriod === "monthly" ? t("subscription.billing.month") : t("subscription.billing.year")}
                      </span>
                    )}
                  </div>
                  {getSavings(plan.id) && (
                    <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                      {t("subscription.billing.saveMoney", { amount: getSavings(plan.id) })}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-2">
                  {plan.featureKeys.map((featureKey, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <span>{t(`subscription.plans.${plan.id}.features.${featureKey}`)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                {isCurrent ? (
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    disabled
                    data-testid={`button-current-${plan.id}`}
                  >
                    {t("subscription.active")}
                  </Button>
                ) : plan.id === "free" ? (
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    disabled
                    data-testid="button-free"
                  >
                    {t("subscription.free")}
                  </Button>
                ) : (
                  <Button
                    className="w-full gap-2 hover-elevate active-elevate-2"
                    onClick={() => createCheckoutMutation.mutate(plan.id)}
                    disabled={createCheckoutMutation.isPending}
                    data-testid={`button-upgrade-${plan.id}`}
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

      {currentPlan !== "free" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("subscription.activeSubscription")}</CardTitle>
            <CardDescription>
              {t("subscription.activeSubscriptionSubtitle", { planName: t(`subscription.plans.${currentPlan}.name`) })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.subscription.currentPeriodEnd && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("subscription.nextRenewal")}</span>
                <span className="font-medium">
                  {new Date(data.subscription.currentPeriodEnd).toLocaleDateString(dateLocale)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
