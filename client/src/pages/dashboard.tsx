import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { BookOpen, Flame, Target, TrendingUp, TrendingDown, Minus, FileText, Clock, CheckCircle2, ArrowUp, ArrowDown, Info, Calendar, Zap, Trophy, Percent } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import type { GetDashboardStatsResponse, FlashcardStats } from "@shared/schema";
import { StudyHeatmap } from "@/components/StudyHeatmap";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es, fr, de, it, type Locale } from "date-fns/locale";
import { GamificationHeader } from "@/components/GamificationHeader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { useMemo, useEffect } from "react";
import { useSubscription } from "@/hooks/useSubscription";

const dateLocaleMap: Record<string, Locale> = {
  pt: ptBR,
  "pt-PT": ptBR,
  "pt-BR": ptBR,
  en: enUS,
  "en-US": enUS,
  "en-GB": enUS,
  "en-CA": enUS,
  es: es,
  "es-ES": es,
  "es-MX": es,
  fr: fr,
  "fr-FR": fr,
  "fr-CA": fr,
  de: de,
  "de-DE": de,
  it: it,
  "it-IT": it,
};

function getDateFnsLocale(language: string): Locale {
  // Try exact match
  if (dateLocaleMap[language]) {
    return dateLocaleMap[language];
  }
  // Try base language (split on '-')
  const baseLang = language.split('-')[0];
  if (dateLocaleMap[baseLang]) {
    return dateLocaleMap[baseLang];
  }
  // Default fallback
  return ptBR;
}

function getDeltaColor(delta: number | undefined): string {
  if (delta === undefined || delta === 0) return "text-muted-foreground";
  return delta > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
}

function getDeltaIcon(delta: number | undefined) {
  if (delta === undefined || delta === 0) return Minus;
  return delta > 0 ? ArrowUp : ArrowDown;
}

function getProgressColor(percentage: number): string {
  if (percentage >= 75) return "text-green-600 dark:text-green-400";
  if (percentage >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const dateLocale = useMemo(() => getDateFnsLocale(i18n.language), [i18n.language]);
  const { subscription, isLoading: isLoadingSubscription } = useSubscription();
  const subscriptionResolved = !isLoadingSubscription;
  const currentPlan = subscription?.plan || "free";

  useEffect(() => {
    if (subscriptionResolved && currentPlan === "free") {
      setLocation("/subscription");
    }
  }, [subscriptionResolved, currentPlan, setLocation]);

  const { data: statsData, isLoading: statsLoading } = useQuery<GetDashboardStatsResponse>({
    queryKey: ["/api/dashboard-stats"],
    enabled: currentPlan !== "free",
  });


  // New KPI queries
  const { data: studyTimeData, isLoading: studyTimeLoading, isError: studyTimeError } = useQuery<{
    currentWeekMinutes: number;
    currentWeekHours: string;
    previousWeekMinutes: number;
    deltaMinutes: number;
    weeklyGoalMinutes: number;
    progressPercentage: number;
  }>({
    queryKey: ["/api/stats/study-time"],
    enabled: currentPlan !== "free",
  });

  const { data: subjectProgressData, isLoading: subjectProgressLoading, isError: subjectProgressError } = useQuery<{
    subjects: Array<{
      subjectId: string;
      subjectName: string;
      subjectColor: string | null;
      totalTopics: number;
      completedTopics: number;
      completionPercentage: number;
    }>;
  }>({
    queryKey: ["/api/stats/subject-progress"],
    enabled: currentPlan !== "free",
  });

  const { data: tasksData, isLoading: tasksLoading, isError: tasksError } = useQuery<{
    completedToday: number;
    completedThisWeek: number;
    pendingTasks: number;
    totalTasks: number;
    status: string;
  }>({
    queryKey: ["/api/stats/tasks-summary"],
    enabled: currentPlan !== "free",
  });

  const { data: streakData, isLoading: streakLoading, isError: streakError } = useQuery<{
    currentStreak: number;
    longestStreak: number;
    todayMinutes: number;
    hasStudiedToday: boolean;
  }>({
    queryKey: ["/api/stats/streak"],
    enabled: currentPlan !== "free",
  });

  const { data: flashcardStatsData, isLoading: flashcardStatsLoading, isError: flashcardStatsError } = useQuery<{
    success: boolean;
    stats: FlashcardStats;
  }>({
    queryKey: ["/api/flashcard-stats"],
    enabled: currentPlan === "premium",
  });

  const hasAnyKpiError = studyTimeError || subjectProgressError || tasksError || streakError;

  if (!subscriptionResolved || currentPlan === "free") {
    return null;
  }

  const stats = statsData?.stats;

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full mx-auto py-4 sm:py-6 md:py-8 px-3 sm:px-4 md:px-6 max-w-7xl">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2" data-testid="title-dashboard">{t("dashboard.title")}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>

        <div className="mb-4 sm:mb-6">
          <GamificationHeader />
        </div>

        <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-4 sm:mb-6 md:mb-8">
          {/* Weekly Study Hours KPI - Spans 2 columns for emphasis */}
          <Card className="hover-elevate transition-all duration-300 border-l-4 border-l-blue-500 sm:col-span-2 lg:col-span-2">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-1 space-y-0 pb-2 px-3 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium">{t("dashboard.kpi.weeklyHours")}</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                      <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground cursor-help" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">{t("dashboard.kpi.tooltipWeeklyGoal")}: {((studyTimeData?.weeklyGoalMinutes || 600) / 60).toFixed(0)}h</p>
                    {studyTimeData && (() => {
                      const remaining = ((studyTimeData.weeklyGoalMinutes || 600) - (studyTimeData.currentWeekMinutes || 0)) / 60;
                      return remaining > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t("dashboard.kpi.tooltipRemaining")}: {remaining.toFixed(1)}h
                        </p>
                      ) : (
                        <p className="text-xs text-green-500">
                          ✓ +{Math.abs(remaining).toFixed(1)}h {t("dashboard.kpi.tooltipBeyondGoal")}
                        </p>
                      );
                    })()}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {studyTimeLoading ? (
                <Skeleton className="h-7 w-14 sm:h-8 sm:w-16" />
              ) : studyTimeError ? (
                <p className="text-xs text-muted-foreground">{t("dashboard.kpi.errorLoading")}</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <div className={`text-2xl sm:text-3xl font-bold ${(studyTimeData?.currentWeekMinutes || 0) === 0 ? 'text-muted-foreground' : ''}`} data-testid="kpi-weekly-hours">
                      {studyTimeData?.currentWeekHours || "0.0"}h
                    </div>
                  </div>
                  {studyTimeData?.deltaMinutes !== undefined && studyTimeData.deltaMinutes !== 0 && (
                    <div className={`flex items-center gap-1 text-xs sm:text-sm font-semibold ${getDeltaColor(studyTimeData.deltaMinutes)} mt-1`}>
                      {getDeltaIcon(studyTimeData.deltaMinutes) === ArrowUp ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      <span>{studyTimeData.deltaMinutes > 0 ? '+' : ''}{(studyTimeData.deltaMinutes / 60).toFixed(1)}h {t("dashboard.kpi.vsLastWeek")}</span>
                    </div>
                  )}
                  {(studyTimeData?.currentWeekMinutes || 0) === 0 ? (
                    <p className="text-xs text-muted-foreground mt-2">{t("dashboard.kpi.emptyStudyTime")}</p>
                  ) : (
                    <div className="mt-2 sm:mt-3 h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500" 
                        style={{ width: `${Math.min(100, studyTimeData?.progressPercentage || 0)}%` }}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Subject Progress KPI - Premium only */}
          {currentPlan === "premium" && (() => {
            // Calculate total progress across ALL subjects
            const totalTopics = subjectProgressData?.subjects?.reduce((sum, s) => sum + s.totalTopics, 0) || 0;
            const completedTopics = subjectProgressData?.subjects?.reduce((sum, s) => sum + s.completedTopics, 0) || 0;
            const overallPercentage = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
            
            return (
              <Card className="hover-elevate transition-all duration-300 border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-1 space-y-0 pb-2 px-3 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium">{t("dashboard.kpi.subjectProgress")}</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Target className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                        {!subjectProgressLoading && !subjectProgressError && totalTopics > 0 && (
                          <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground cursor-help" />
                        )}
                      </div>
                    </TooltipTrigger>
                    {totalTopics > 0 && (
                      <TooltipContent>
                        <p className="text-sm font-semibold">{t("dashboard.kpi.tooltipTotalProgress")}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("dashboard.kpi.topicsProgress", { completed: completedTopics, total: totalTopics })}
                        </p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                {subjectProgressLoading ? (
                  <Skeleton className="h-7 w-14 sm:h-8 sm:w-16" />
                ) : subjectProgressError ? (
                  <p className="text-xs text-muted-foreground">{t("dashboard.kpi.errorLoading")}</p>
                ) : totalTopics === 0 ? (
                  <>
                    <div className="text-2xl sm:text-3xl font-bold text-muted-foreground animate-pulse" data-testid="kpi-subject-progress">0%</div>
                    <p className="text-xs text-muted-foreground mt-2">{t("dashboard.kpi.emptySubjects")}</p>
                    <Link href="/">
                      <Button variant="ghost" size="sm" className="mt-2 sm:mt-3 h-7 sm:h-8 text-xs hover-elevate" data-testid="button-create-subject">
                        {t("dashboard.kpi.createFirst")}
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <div className={`text-2xl sm:text-3xl font-bold ${getProgressColor(overallPercentage)}`} data-testid="kpi-subject-progress">
                      {overallPercentage}%
                    </div>
                    <div className="mt-2 sm:mt-3 h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-500" 
                        style={{ width: `${overallPercentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 sm:mt-2">
                      {t("dashboard.kpi.topicsProgress", { completed: completedTopics, total: totalTopics })}
                    </p>
                  </>
                )}
              </CardContent>
              </Card>
            );
          })()}

          {/* Tasks Completed KPI - Premium only */}
          {currentPlan === "premium" && (tasksLoading || tasksError || (tasksData && tasksData.totalTasks > 0)) && (
            <Card className="hover-elevate transition-all duration-300 border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-1 space-y-0 pb-2 px-3 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium">{t("dashboard.kpi.tasksCompleted")}</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500" />
                      {!tasksLoading && !tasksError && tasksData && tasksData.totalTasks > 0 && (
                        <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground cursor-help" />
                      )}
                    </div>
                  </TooltipTrigger>
                  {tasksData && tasksData.totalTasks > 0 && (
                    <TooltipContent>
                      <p className="text-sm">{t("dashboard.kpi.tooltipTotalTasks")}: {tasksData.totalTasks}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("dashboard.kpi.tooltipPendingTasks")}: {tasksData.pendingTasks || 0}
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {tasksLoading ? (
                <Skeleton className="h-7 w-14 sm:h-8 sm:w-16" />
              ) : tasksError ? (
                <p className="text-xs text-muted-foreground">{t("dashboard.kpi.errorLoading")}</p>
              ) : (
                <>
                  <div className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400" data-testid="kpi-tasks-completed">
                    {tasksData?.completedToday || 0}
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mt-1 sm:mt-2">
                    {t("dashboard.kpi.tasksToday")}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px] sm:text-xs">
                      {tasksData?.completedThisWeek || 0} {t("dashboard.kpi.tasksThisWeek")}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
            </Card>
          )}

          {/* Study Streak KPI */}
          <Card className="hover-elevate transition-all duration-300 border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-1 space-y-0 pb-2 px-3 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium">{t("dashboard.kpi.studyStreak")}</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Flame className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
                      {!streakLoading && !streakError && streakData && streakData.currentStreak > 0 && (
                        <Info className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground cursor-help" />
                      )}
                    </div>
                  </TooltipTrigger>
                  {streakData && streakData.currentStreak > 0 && (
                    <TooltipContent>
                      <p className="text-sm">{t("dashboard.kpi.tooltipCurrentStreak")}: {streakData.currentStreak} {t("dashboard.kpi.days")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("dashboard.kpi.tooltipRecord")}: {streakData.longestStreak} {t("dashboard.kpi.days")}
                      </p>
                      {streakData.hasStudiedToday && (
                        <p className="text-xs text-green-500">✓ {t("dashboard.kpi.tooltipToday")}: {streakData.todayMinutes || 0} min</p>
                      )}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {streakLoading ? (
                <Skeleton className="h-7 w-14 sm:h-8 sm:w-16" />
              ) : streakError ? (
                <p className="text-xs text-muted-foreground">{t("dashboard.kpi.errorLoading")}</p>
              ) : (streakData?.currentStreak || 0) === 0 && (streakData?.longestStreak || 0) === 0 ? (
                <>
                  <div className="text-2xl sm:text-3xl font-bold text-muted-foreground animate-pulse" data-testid="kpi-study-streak">0 {t("dashboard.kpi.days")}</div>
                  <p className="text-xs text-muted-foreground mt-1 sm:mt-2">{t("dashboard.kpi.emptyStreak")}</p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-1 sm:gap-2">
                    <div className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400" data-testid="kpi-study-streak">
                      {streakData?.currentStreak || 0}
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">{t("dashboard.kpi.days")}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 sm:mt-2">
                    {streakData?.hasStudiedToday ? (
                      <Badge variant="default" className="text-[10px] sm:text-xs bg-green-600 dark:bg-green-500">
                        ✓ {t("dashboard.kpi.studiedToday")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] sm:text-xs">
                        {t("dashboard.kpi.notStudiedToday")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 sm:mt-2">
                    {t("dashboard.kpi.longestStreak")}: {streakData?.longestStreak || 0}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Anki-style Flashcard Statistics - Premium only */}
        {currentPlan === "premium" && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t("flashcardStats.title")}
              </CardTitle>
              <CardDescription>{t("flashcardStats.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              {flashcardStatsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                </div>
              ) : flashcardStatsError ? (
                <p className="text-sm text-muted-foreground">{t("flashcardStats.error")}</p>
              ) : flashcardStatsData?.stats ? (
                <div className="space-y-6">
                  <StudyHeatmap 
                    data={flashcardStatsData.stats.heatmapData} 
                    isLoading={flashcardStatsLoading}
                  />
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium text-muted-foreground">
                          {t("flashcardStats.dailyAverage")}
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="stat-daily-average">
                        {flashcardStatsData.stats.dailyAverage} {t("flashcardStats.cards")}
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2 mb-2">
                        <Percent className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-muted-foreground">
                          {t("flashcardStats.daysLearned")}
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="stat-days-learned">
                        {flashcardStatsData.stats.daysLearnedPercentage}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {flashcardStatsData.stats.daysLearned} {t("flashcardStats.days")}
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium text-muted-foreground">
                          {t("flashcardStats.longestStreak")}
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="stat-longest-streak">
                        {flashcardStatsData.stats.longestStreak} {t("flashcardStats.days")}
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <div className="flex items-center gap-2 mb-2">
                        <Flame className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-muted-foreground">
                          {t("flashcardStats.currentStreak")}
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="stat-current-streak">
                        {flashcardStatsData.stats.currentStreak} {t("flashcardStats.days")}
                      </div>
                    </div>
                  </div>
                  
                  {flashcardStatsData.stats.totalCardsReviewed > 0 && (
                    <div className="text-center text-sm text-muted-foreground">
                      {t("flashcardStats.totalCards")}: <span className="font-semibold">{flashcardStatsData.stats.totalCardsReviewed.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t("flashcardStats.empty")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
