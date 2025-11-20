import { useQuery } from "@tanstack/react-query";
import type { Subscription, UsageTracking, SubscriptionPlan } from "@shared/schema";
import { planLimits } from "@shared/schema";

interface SubscriptionDetails {
  subscription: Subscription;
  usage: UsageTracking;
  limits: typeof planLimits[SubscriptionPlan];
}

export function useSubscription() {
  const { data, isLoading, error, refetch } = useQuery<SubscriptionDetails>({
    queryKey: ["/api/subscription"],
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 30000,
  });

  const canUpload = () => {
    if (!data) return false;
    const { usage, limits } = data;
    if (limits.uploadsPerMonth === -1) return true;
    return usage.uploadsCount < limits.uploadsPerMonth;
  };

  const canSendChatMessage = () => {
    if (!data) return false;
    const { usage, limits } = data;
    if (limits.dailyChatLimit === -1) return true;
    return usage.chatMessagesCount < limits.dailyChatLimit;
  };

  const hasFeature = (feature: keyof typeof planLimits.free) => {
    if (!data) return false;
    return !!data.limits[feature];
  };

  const isUploadLimitReached = () => {
    if (!data) return false;
    const { usage, limits } = data;
    if (limits.uploadsPerMonth === -1) return false;
    return usage.uploadsCount >= limits.uploadsPerMonth;
  };

  const isChatLimitReached = () => {
    if (!data) return false;
    const { usage, limits } = data;
    if (limits.dailyChatLimit === -1) return false;
    return usage.chatMessagesCount >= limits.dailyChatLimit;
  };

  const getUploadUsageText = (t: (key: string, params?: any) => string) => {
    if (!data) return "";
    const { usage, limits } = data;
    if (limits.uploadsPerMonth === -1) {
      return t("limits.usage.uploadsUnlimited", { used: usage.uploadsCount });
    }
    return t("limits.usage.uploads", {
      used: usage.uploadsCount,
      limit: limits.uploadsPerMonth,
    });
  };

  const getChatUsageText = (t: (key: string, params?: any) => string) => {
    if (!data) return "";
    const { usage, limits } = data;
    if (limits.dailyChatLimit === -1) {
      return t("limits.usage.chatUnlimited", { used: usage.chatMessagesCount });
    }
    return t("limits.usage.chatMessages", {
      used: usage.chatMessagesCount,
      limit: limits.dailyChatLimit,
    });
  };

  return {
    subscription: data?.subscription,
    usage: data?.usage,
    limits: data?.limits,
    isLoading,
    error,
    refetch,
    canUpload,
    canSendChatMessage,
    hasFeature,
    isUploadLimitReached,
    isChatLimitReached,
    getUploadUsageText,
    getChatUsageText,
  };
}
