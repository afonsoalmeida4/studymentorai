import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LevelBadge } from "@/components/LevelBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Award } from "lucide-react";
import { type UserLevel } from "@shared/schema";
import { useTranslation } from "react-i18next";

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

export default function Ranking() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<{ success: boolean; leaderboard: LeaderboardEntry[] }>({
    queryKey: ["/api/leaderboard"],
  });

  function getUserDisplayName(entry: LeaderboardEntry): string {
    if (entry.displayName) return entry.displayName;
    if (entry.firstName && entry.lastName) return `${entry.firstName} ${entry.lastName}`;
    if (entry.firstName) return entry.firstName;
    return t("ranking.anonymousUser");
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden min-w-0">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6 min-w-0">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold" data-testid="heading-ranking">
            {t("ranking.title")}
          </h1>
          <p className="text-muted-foreground" data-testid="text-ranking-description">
            {t("ranking.subtitle")}
          </p>
        </div>

        <Card data-testid="card-leaderboard">
          <CardHeader>
            <CardTitle>{t("ranking.topUsers")}</CardTitle>
            <CardDescription>
              {t("ranking.rankedBy")}
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
                {t("ranking.empty")}
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
                          {entry.totalXp.toLocaleString()} {t("common.xp")}
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
            <CardTitle>{t("ranking.howToClimb")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary rounded-lg p-2 mt-0.5">
                <span className="font-bold">{t("ranking.actions.generateSummary.xp")}</span>
              </div>
              <div>
                <div className="font-medium">{t("ranking.actions.generateSummary.title")}</div>
                <div className="text-sm text-muted-foreground">
                  {t("ranking.actions.generateSummary.description")}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary rounded-lg p-2 mt-0.5">
                <span className="font-bold">{t("ranking.actions.createFlashcards.xp")}</span>
              </div>
              <div>
                <div className="font-medium">{t("ranking.actions.createFlashcards.title")}</div>
                <div className="text-sm text-muted-foreground">
                  {t("ranking.actions.createFlashcards.description")}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary rounded-lg p-2 mt-0.5">
                <span className="font-bold">{t("ranking.actions.completeSession.xp")}</span>
              </div>
              <div>
                <div className="font-medium">{t("ranking.actions.completeSession.title")}</div>
                <div className="text-sm text-muted-foreground">
                  {t("ranking.actions.completeSession.description")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
