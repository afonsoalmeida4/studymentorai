import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Rocket, Zap, ArrowRight } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

type UpgradeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limitType: "uploads" | "chat" | "summaries" | "features";
  currentPlan: string;
};

export function UpgradeDialog({ open, onOpenChange, limitType, currentPlan }: UpgradeDialogProps) {
  const { toast } = useToast();
  const { t } = useTranslation();

  const createCheckoutMutation = useMutation({
    mutationFn: async (plan: string) => {
      return await apiRequest("POST", "/api/subscription/create-checkout", { plan });
    },
    onSuccess: (data) => {
      console.log("UpgradeDialog - Checkout response:", data);
      if (data.url) {
        console.log("UpgradeDialog - Redirecting to:", data.url);
        window.location.href = data.url;
      } else {
        console.error("UpgradeDialog - No URL in response:", data);
        toast({
          title: t('common.error'),
          description: t('upgradeDialog.errorNoUrl'),
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error("UpgradeDialog - Checkout error:", error);
      toast({
        title: t('common.error'),
        description: t('upgradeDialog.errorCheckout'),
        variant: "destructive",
      });
    },
  });

  const getContent = () => {
    switch (limitType) {
      case "uploads":
        return {
          title: t('upgradeDialog.uploads.title'),
          description: t('upgradeDialog.uploads.description'),
          icon: Zap,
          benefits: [
            t('upgradeDialog.uploads.benefit1'),
            t('upgradeDialog.uploads.benefit2'),
            t('upgradeDialog.uploads.benefit3'),
            t('upgradeDialog.uploads.benefit4'),
          ],
        };
      case "chat":
        return {
          title: t('upgradeDialog.chat.title'),
          description: t('upgradeDialog.chat.description'),
          icon: Crown,
          benefits: [
            t('upgradeDialog.chat.benefit1'),
            t('upgradeDialog.chat.benefit2'),
            t('upgradeDialog.chat.benefit3'),
            t('upgradeDialog.chat.benefit4'),
          ],
        };
      case "summaries":
        return {
          title: t('upgradeDialog.summaries.title'),
          description: t('upgradeDialog.summaries.description'),
          icon: Rocket,
          benefits: [
            t('upgradeDialog.summaries.benefit1'),
            t('upgradeDialog.summaries.benefit2'),
            t('upgradeDialog.summaries.benefit3'),
            t('upgradeDialog.summaries.benefit4'),
          ],
        };
      case "features":
        return {
          title: t('upgradeDialog.features.title'),
          description: t('upgradeDialog.features.description'),
          icon: Crown,
          benefits: [
            t('upgradeDialog.features.benefit1'),
            t('upgradeDialog.features.benefit2'),
            t('upgradeDialog.features.benefit3'),
            t('upgradeDialog.features.benefit4'),
          ],
        };
    }
  };

  const content = getContent();
  const Icon = content.icon;
  const recommendedPlan = currentPlan === "free" ? "pro" : "premium";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-upgrade">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Icon className="h-6 w-6 text-primary" />
            <DialogTitle data-testid="text-upgrade-title">{content.title}</DialogTitle>
          </div>
          <DialogDescription data-testid="text-upgrade-description">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('upgradeDialog.benefitsTitle')}</p>
            <ul className="space-y-2">
              {content.benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <ArrowRight className="h-3 w-3 text-primary" />
                  </div>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-upgrade"
          >
            {t('upgradeDialog.notNow')}
          </Button>
          <Button
            onClick={() => createCheckoutMutation.mutate(recommendedPlan)}
            disabled={createCheckoutMutation.isPending}
            className="gap-2"
            data-testid="button-confirm-upgrade"
          >
            <Crown className="h-4 w-4" />
            {createCheckoutMutation.isPending ? t('upgradeDialog.processing') : t('upgradeDialog.upgradeButton', { price: recommendedPlan === "pro" ? "7,99€" : "18,99€" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
