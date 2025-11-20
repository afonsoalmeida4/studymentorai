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
import { useEffect, useMemo } from "react";
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
      return await apiRequest("POST", "/api/subscription/create-checkout", { plan });
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

  const plans = [
    {
      id: "free",
      icon: Zap,
      color: "text-muted-foreground",
      featureKeys: ["uploads", "summaries", "flashcards", "assistant", "chatLimit", "workspace"],
    },
    {
      id: "pro",
      icon: Crown,
      color: "text-blue-600 dark:text-blue-400",
      popular: true,
      featureKeys: ["uploads", "summaries", "flashcards", "assistant", "chat", "workspaces", "dashboard", "backup"],
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
      <div className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="text-subscription-title">
          {t("subscription.title")}
        </h1>
        <p className="text-muted-foreground" data-testid="text-subscription-subtitle">
          {t("subscription.subtitle")}
        </p>
      </div>

      {currentPlan === "free" && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle>{t("subscription.currentUsage")}</CardTitle>
            <CardDescription>{t("subscription.currentUsageSubtitle")}</CardDescription>
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
                <div className="mt-4">
                  <span className="text-3xl font-bold">
                    {plan.id === "free" ? t("subscription.free") : t(`subscription.plans.${plan.id}.price`)}
                  </span>
                  {plan.id !== "free" && (
                    <span className="text-muted-foreground">{t(`subscription.plans.${plan.id}.period`)}</span>
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
