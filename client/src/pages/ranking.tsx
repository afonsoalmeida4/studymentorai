import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LevelBadge } from "@/components/LevelBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Award, Crown } from "lucide-react";
import { type UserLevel } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 overflow-x-hidden min-w-0">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6 min-w-0">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center space-y-3"
        >
          <div className="inline-flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-yellow-500 blur-lg opacity-40 rounded-full" />
              <div className="relative p-4 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-500/20 shadow-xl">
                <Crown className="h-8 w-8 text-amber-500" />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent" data-testid="heading-ranking">
            {t("ranking.title")}
          </h1>
          <p className="text-muted-foreground" data-testid="text-ranking-description">
            {t("ranking.subtitle")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
        <Card className="relative overflow-hidden" data-testid="card-leaderboard">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-yellow-500/5" />
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500 to-yellow-500 rounded-l-md" />
          <CardHeader className="relative">
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-500/5" />
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-purple-500 rounded-l-md" />
          <CardHeader className="relative">
            <CardTitle>{t("ranking.howToClimb")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 relative">
            <div className="flex items-start gap-3">
              <div className="bg-gradient-to-br from-emerald-500/20 to-green-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg p-2 mt-0.5 shadow-sm">
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
              <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400 rounded-lg p-2 mt-0.5 shadow-sm">
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
              <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 rounded-lg p-2 mt-0.5 shadow-sm">
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
        </motion.div>
      </div>
    </div>
  );
}
