import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LevelBadge } from "@/components/LevelBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Award } from "lucide-react";
import { type UserLevel } from "@shared/schema";

interface LeaderboardEntry {
  userId: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  totalXp: number;
  currentLevel: string;
  rank: number;
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="h-6 w-6 text-amber-500" />;
  if (rank === 2) return <Medal className="h-6 w-6 text-slate-400" />;
  if (rank === 3) return <Award className="h-6 w-6 text-amber-700" />;
  return null;
}

function getUserDisplayName(entry: LeaderboardEntry): string {
  if (entry.displayName) return entry.displayName;
  if (entry.firstName && entry.lastName) return `${entry.firstName} ${entry.lastName}`;
  if (entry.firstName) return entry.firstName;
  return "Utilizador Anónimo";
}

export default function Ranking() {
  const { data, isLoading } = useQuery<{ success: boolean; leaderboard: LeaderboardEntry[] }>({
    queryKey: ["/api/leaderboard"],
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold" data-testid="heading-ranking">
            Classificação Global
          </h1>
          <p className="text-muted-foreground" data-testid="text-ranking-description">
            Os melhores estudantes da comunidade
          </p>
        </div>

        <Card data-testid="card-leaderboard">
          <CardHeader>
            <CardTitle>Top 10 Utilizadores</CardTitle>
            <CardDescription>
              Classificados por XP total acumulado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                ))}
              </div>
            ) : !data?.success || data.leaderboard.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Ainda não há utilizadores no ranking
              </div>
            ) : (
              <div className="space-y-2">
                {data.leaderboard.map((entry) => {
                  const displayName = getUserDisplayName(entry);
                  const isPodium = entry.rank <= 3;

                  return (
                    <div
                      key={entry.userId}
                      className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                        isPodium ? "bg-accent/50" : "hover-elevate"
                      }`}
                      data-testid={`row-leaderboard-${entry.rank}`}
                    >
                      <div className="flex items-center justify-center w-10 h-10">
                        {getRankIcon(entry.rank) || (
                          <span className="font-bold text-muted-foreground">
                            {entry.rank}
                          </span>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="font-medium" data-testid={`text-user-name-${entry.rank}`}>
                          {displayName}
                        </div>
                        <div className="text-sm text-muted-foreground" data-testid={`text-user-xp-${entry.rank}`}>
                          {entry.totalXp.toLocaleString()} XP
                        </div>
                      </div>

                      <LevelBadge
                        level={entry.currentLevel as UserLevel}
                        levelName={entry.currentLevel}
                        showName={false}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Como subir no ranking?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary rounded-lg p-2 mt-0.5">
                <span className="font-bold">+100</span>
              </div>
              <div>
                <div className="font-medium">Gerar Resumo</div>
                <div className="text-sm text-muted-foreground">
                  Faz upload de um PDF e gera um resumo personalizado
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary rounded-lg p-2 mt-0.5">
                <span className="font-bold">+30</span>
              </div>
              <div>
                <div className="font-medium">Criar Flashcards</div>
                <div className="text-sm text-muted-foreground">
                  Gera flashcards a partir dos teus resumos
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary rounded-lg p-2 mt-0.5">
                <span className="font-bold">+20+</span>
              </div>
              <div>
                <div className="font-medium">Completar Sessão de Estudo</div>
                <div className="text-sm text-muted-foreground">
                  Estuda com flashcards e ganha +5 XP por cada acerto
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
