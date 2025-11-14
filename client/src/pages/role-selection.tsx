import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { GraduationCap, UserRound } from "lucide-react";
import type { User } from "@shared/schema";

export default function RoleSelection() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const updateRoleMutation = useMutation({
    mutationFn: async (role: "student" | "teacher") => {
      return await apiRequest("POST", "/api/user/role", { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/dashboard");
    },
  });

  if (!user) {
    return null;
  }

  const typedUser = user as User;

  if (typedUser.role) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold" data-testid="text-welcome-title">
            Bem-vindo ao AI Study Mentor
          </h1>
          <p className="text-lg text-muted-foreground" data-testid="text-welcome-subtitle">
            Como gostarias de usar a plataforma?
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card 
            className="hover-elevate cursor-pointer transition-all"
            onClick={() => !updateRoleMutation.isPending && updateRoleMutation.mutate("student")}
            data-testid="card-role-student"
          >
            <CardHeader className="space-y-4">
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-primary/10">
                  <UserRound className="w-12 h-12 text-primary" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <CardTitle className="text-2xl">Sou Aluno</CardTitle>
                <CardDescription className="text-base">
                  Organiza o teu conhecimento, estuda com IA e acompanha o teu progresso
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Cria e organiza os teus materiais de estudo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Gera resumos e flashcards com IA</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Junta-te a turmas dos teus professores</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Acompanha o teu XP, nível e progresso</span>
                </li>
              </ul>
              <Button 
                className="w-full" 
                size="lg"
                disabled={updateRoleMutation.isPending}
                data-testid="button-select-student"
              >
                Continuar como Aluno
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="hover-elevate cursor-pointer transition-all"
            onClick={() => !updateRoleMutation.isPending && updateRoleMutation.mutate("teacher")}
            data-testid="card-role-teacher"
          >
            <CardHeader className="space-y-4">
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-primary/10">
                  <GraduationCap className="w-12 h-12 text-primary" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <CardTitle className="text-2xl">Sou Professor</CardTitle>
                <CardDescription className="text-base">
                  Cria turmas, convida alunos e acompanha o progresso da turma
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Cria e gere as tuas turmas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Convida alunos com códigos únicos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Monitoriza XP, nível e streaks dos alunos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>Acompanha o progresso e engagement da turma</span>
                </li>
              </ul>
              <Button 
                className="w-full" 
                size="lg"
                disabled={updateRoleMutation.isPending}
                data-testid="button-select-teacher"
              >
                Continuar como Professor
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground" data-testid="text-role-change-info">
          Poderás alterar o teu role mais tarde nas configurações
        </p>
      </div>
    </div>
  );
}
