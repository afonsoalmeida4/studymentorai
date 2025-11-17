import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Rocket, Zap, ArrowRight } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type UpgradeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limitType: "uploads" | "chat" | "summaries" | "features";
  currentPlan: string;
};

export function UpgradeDialog({ open, onOpenChange, limitType, currentPlan }: UpgradeDialogProps) {
  const { toast } = useToast();

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
          title: "Erro",
          description: "URL de pagamento não recebido",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error("UpgradeDialog - Checkout error:", error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o processo de pagamento",
        variant: "destructive",
      });
    },
  });

  const getContent = () => {
    switch (limitType) {
      case "uploads":
        return {
          title: "Limite de Uploads Atingido",
          description: "Atingiste o limite de 3 uploads por mês do plano Free. Faz upgrade para continuar a carregar documentos ilimitadamente!",
          icon: Zap,
          benefits: [
            "Uploads ilimitados de PDFs, Word e PowerPoint",
            "Resumos ilimitados com estilos de aprendizagem",
            "Flashcards inteligentes com spaced repetition",
            "Assistente IA disponível 24/7",
          ],
        };
      case "chat":
        return {
          title: "Limite de Chat Atingido",
          description: "Atingiste o limite de 10 mensagens por dia do plano Free. Faz upgrade para conversar sem limites com o teu AI Mentor!",
          icon: Crown,
          benefits: [
            "Chat ilimitado com IA (Modo Estudo e Existencial)",
            "Uploads e resumos ilimitados",
            "Dashboard de progresso avançado",
            "Flashcards inteligentes",
          ],
        };
      case "summaries":
        return {
          title: "Limite de Resumos Atingido",
          description: "Os resumos do plano Free são limitados a 1.000 palavras. Faz upgrade para resumos ilimitados e completos!",
          icon: Rocket,
          benefits: [
            "Resumos ilimitados (sem limite de palavras)",
            "Estilos de aprendizagem personalizados",
            "Uploads ilimitados",
            "Chat ilimitado com IA",
          ],
        };
      case "features":
        return {
          title: "Funcionalidade Premium",
          description: "Esta funcionalidade está disponível apenas para planos pagos. Faz upgrade para aceder a todas as ferramentas avançadas!",
          icon: Crown,
          benefits: [
            "Acesso a todas as funcionalidades Premium",
            "Tutor IA pessoal",
            "Planos de estudo automáticos",
            "Estatísticas avançadas e mapas mentais",
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
            <p className="text-sm font-medium">Com o upgrade vais ter:</p>
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
            Agora Não
          </Button>
          <Button
            onClick={() => createCheckoutMutation.mutate(recommendedPlan)}
            disabled={createCheckoutMutation.isPending}
            className="gap-2"
            data-testid="button-confirm-upgrade"
          >
            <Crown className="h-4 w-4" />
            {createCheckoutMutation.isPending ? "A processar..." : `Fazer Upgrade (${recommendedPlan === "pro" ? "7,99€" : "18,99€"}/mês)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
