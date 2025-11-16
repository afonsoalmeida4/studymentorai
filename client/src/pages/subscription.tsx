import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Crown, Zap, Rocket, GraduationCap, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Subscription, UsageTracking, SubscriptionPlan } from "@shared/schema";
import { planLimits } from "@shared/schema";

type SubscriptionDetails = {
  subscription: Subscription;
  usage: UsageTracking;
  limits: typeof planLimits[SubscriptionPlan];
};

export default function SubscriptionPage() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<SubscriptionDetails>({
    queryKey: ["/api/subscription"],
  });

  const createCheckoutMutation = useMutation({
    mutationFn: async (plan: string) => {
      return await apiRequest("POST", "/api/subscription/create-checkout", { plan });
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o processo de pagamento",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
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
      name: "Começa a Estudar",
      price: "0€",
      icon: Zap,
      color: "text-muted-foreground",
      features: [
        "3 uploads por mês",
        "Resumos até 1.000 palavras",
        "Flashcards simples",
        "Assistente IA (Modo Estudo)",
        "Limite de 10 mensagens/dia",
        "1 workspace",
      ],
    },
    {
      id: "pro",
      name: "Estuda Sem Limites",
      price: "7,99€",
      period: "/mês",
      icon: Crown,
      color: "text-blue-600 dark:text-blue-400",
      popular: true,
      features: [
        "Uploads ilimitados",
        "Resumos ilimitados",
        "Flashcards inteligentes",
        "Assistente IA (Todos os modos)",
        "Chat ilimitado",
        "Workspaces ilimitados",
        "Dashboard de progresso",
        "Backup automático",
      ],
    },
    {
      id: "premium",
      name: "Alta Performance",
      price: "18,99€",
      period: "/mês",
      icon: Rocket,
      color: "text-purple-600 dark:text-purple-400",
      features: [
        "Tudo do Pro +",
        "Tutor IA pessoal",
        "Planos de estudo automáticos",
        "Mapas mentais automáticos",
        "Estatísticas avançadas",
        "Modo Zen",
        "Espaços partilhados",
        "Exportação PDF",
        "Acesso antecipado",
      ],
    },
    {
      id: "educational",
      name: "AI Classroom Pro",
      price: "14,99€",
      period: "/mês",
      icon: GraduationCap,
      color: "text-green-600 dark:text-green-400",
      features: [
        "Tudo do Premium +",
        "Gestão de turmas",
        "Biblioteca partilhada",
        "Dashboard da turma",
        "AI Teacher Assistant",
        "Criar fichas de exercícios",
        "Mini-testes automáticos",
        "Planos de aula",
      ],
    },
  ];

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold" data-testid="text-subscription-title">
          O Teu Plano
        </h1>
        <p className="text-muted-foreground" data-testid="text-subscription-subtitle">
          Escolhe o plano ideal para os teus objetivos de estudo
        </p>
      </div>

      {currentPlan === "free" && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle>Utilização Atual</CardTitle>
            <CardDescription>Progresso do plano Free este mês</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Uploads</span>
                <span className="text-muted-foreground">
                  {usage.uploadsCount} / {limits.uploadsPerMonth}
                </span>
              </div>
              <Progress value={uploadPercentage} data-testid="progress-uploads" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Mensagens de chat (hoje)</span>
                <span className="text-muted-foreground">
                  {usage.chatMessagesCount} / {limits.dailyChatLimit}
                </span>
              </div>
              <Progress value={chatPercentage} data-testid="progress-chat" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                    Mais Popular
                  </Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="outline" className="bg-background" data-testid="badge-current">
                    Plano Atual
                  </Badge>
                </div>
              )}

              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className={`h-6 w-6 ${plan.color}`} />
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground">{plan.period}</span>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <span>{feature}</span>
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
                    Ativo
                  </Button>
                ) : plan.id === "free" ? (
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    disabled
                    data-testid="button-free"
                  >
                    Grátis
                  </Button>
                ) : (
                  <Button
                    className="w-full gap-2 hover-elevate active-elevate-2"
                    onClick={() => createCheckoutMutation.mutate(plan.id)}
                    disabled={createCheckoutMutation.isPending}
                    data-testid={`button-upgrade-${plan.id}`}
                  >
                    Fazer Upgrade
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
            <CardTitle>Subscrição Ativa</CardTitle>
            <CardDescription>
              O teu plano {limits.name} está ativo e renovará automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.subscription.currentPeriodEnd && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Próxima renovação</span>
                <span className="font-medium">
                  {new Date(data.subscription.currentPeriodEnd).toLocaleDateString("pt-PT")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
