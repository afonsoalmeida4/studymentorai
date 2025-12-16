import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { BookOpen, Flame, Target, TrendingUp, TrendingDown, Minus, FileText, Clock, CheckCircle2, ArrowUp, ArrowDown, Info, Calendar, Zap, Trophy, Percent, Sparkles } from "lucide-react";
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
import { motion } from "framer-motion";

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
    <div className="flex-1 bg-background overflow-y-auto overflow-x-hidden min-w-0">
      <div className="w-full mx-auto py-4 sm:py-6 md:py-8 px-2 sm:px-4 md:px-6 max-w-7xl min-w-0">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2" data-testid="title-dashboard">{t("dashboard.title")}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>

        <div className="mb-4 sm:mb-6">
          <GamificationHeader />
        </div>

        <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-4 sm:mb-6 md:mb-8">
          {/* Weekly Study Hours KPI - Spans 2 columns for emphasis */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="sm:col-span-2 lg:col-span-2"
          >
            <Card className="relative overflow-hidden hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-sky-500/5" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-sky-500 rounded-l-md" />
              <CardHeader className="pb-2 px-3 sm:px-4 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-sky-500/20 shadow-sm">
                      <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    </div>
                    <CardTitle className="text-xs sm:text-sm font-medium truncate">{t("dashboard.kpi.weeklyHours")}</CardTitle>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help flex-shrink-0 ml-1 hover:text-foreground transition-colors" />
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
                            <p className="text-xs text-emerald-500">
                              +{Math.abs(remaining).toFixed(1)}h {t("dashboard.kpi.tooltipBeyondGoal")}
                            </p>
                          );
                        })()}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 relative">
                {studyTimeLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-2.5 w-full rounded-full" />
                  </div>
                ) : studyTimeError ? (
                  <p className="text-xs text-muted-foreground">{t("dashboard.kpi.errorLoading")}</p>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <motion.div 
                        className={`text-2xl sm:text-3xl font-bold ${(studyTimeData?.currentWeekMinutes || 0) === 0 ? 'text-muted-foreground/50' : 'text-blue-600 dark:text-blue-400'}`} 
                        data-testid="kpi-weekly-hours"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.3, type: "spring" }}
                      >
                        {studyTimeData?.currentWeekHours || "0.0"}h
                      </motion.div>
                      {studyTimeData?.deltaMinutes !== undefined && studyTimeData.deltaMinutes !== 0 && (
                        <motion.div
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.4 }}
                          className={`flex items-center gap-1 text-xs font-semibold ${getDeltaColor(studyTimeData.deltaMinutes)}`}
                        >
                          {getDeltaIcon(studyTimeData.deltaMinutes) === ArrowUp ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          <span>{studyTimeData.deltaMinutes > 0 ? '+' : ''}{(studyTimeData.deltaMinutes / 60).toFixed(1)}h</span>
                        </motion.div>
                      )}
                    </div>
                    {(studyTimeData?.currentWeekMinutes || 0) === 0 ? (
                      <p className="text-xs text-muted-foreground mt-2">{t("dashboard.kpi.emptyStudyTime")}</p>
                    ) : (
                      <motion.div 
                        className="mt-3 h-2.5 bg-muted rounded-full overflow-hidden"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                        style={{ transformOrigin: "left" }}
                      >
                        <motion.div 
                          className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 rounded-full" 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, studyTimeData?.progressPercentage || 0)}%` }}
                          transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                        />
                      </motion.div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Subject Progress KPI - Premium only */}
          {currentPlan === "premium" && (() => {
            const totalTopics = subjectProgressData?.subjects?.reduce((sum, s) => sum + s.totalTopics, 0) || 0;
            const completedTopics = subjectProgressData?.subjects?.reduce((sum, s) => sum + s.completedTopics, 0) || 0;
            const overallPercentage = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
            
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <Card className="relative overflow-hidden hover:shadow-lg transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-green-500/5" />
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-green-500 rounded-l-md" />
                  <CardHeader className="pb-2 px-3 sm:px-4 relative">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/20 shadow-sm">
                          <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        </div>
                        <CardTitle className="text-xs sm:text-sm font-medium truncate">{t("dashboard.kpi.subjectProgress")}</CardTitle>
                      </div>
                      {!subjectProgressLoading && !subjectProgressError && totalTopics > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help flex-shrink-0 ml-1 hover:text-foreground transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-sm font-semibold">{t("dashboard.kpi.tooltipTotalProgress")}</p>
                              <p className="text-xs text-muted-foreground">
                                {t("dashboard.kpi.topicsProgress", { completed: completedTopics, total: totalTopics })}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-4 relative">
                    {subjectProgressLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-2.5 w-full rounded-full" />
                      </div>
                    ) : subjectProgressError ? (
                      <p className="text-xs text-muted-foreground">{t("dashboard.kpi.errorLoading")}</p>
                    ) : totalTopics === 0 ? (
                      <>
                        <div className="text-2xl sm:text-3xl font-bold text-muted-foreground/50" data-testid="kpi-subject-progress">0%</div>
                        <p className="text-xs text-muted-foreground mt-2">{t("dashboard.kpi.emptySubjects")}</p>
                        <Link href="/">
                          <Button variant="outline" size="sm" className="mt-3 h-8 text-xs gap-1" data-testid="button-create-subject">
                            <Sparkles className="h-3 w-3" />
                            {t("dashboard.kpi.createFirst")}
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <>
                        <motion.div 
                          className={`text-2xl sm:text-3xl font-bold ${getProgressColor(overallPercentage)}`} 
                          data-testid="kpi-subject-progress"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.3, type: "spring" }}
                        >
                          {overallPercentage}%
                        </motion.div>
                        <motion.div 
                          className="mt-3 h-2.5 bg-muted rounded-full overflow-hidden"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: 0.4, duration: 0.5 }}
                          style={{ transformOrigin: "left" }}
                        >
                          <motion.div 
                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full" 
                            initial={{ width: 0 }}
                            animate={{ width: `${overallPercentage}%` }}
                            transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                          />
                        </motion.div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {t("dashboard.kpi.topicsProgress", { completed: completedTopics, total: totalTopics })}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })()}

          {/* Tasks Completed KPI - Premium only */}
          {currentPlan === "premium" && (tasksLoading || tasksError || (tasksData && tasksData.totalTasks > 0)) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <Card className="relative overflow-hidden hover:shadow-lg transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-purple-500/5" />
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-purple-500 rounded-l-md" />
                <CardHeader className="pb-2 px-3 sm:px-4 relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 shadow-sm">
                        <CheckCircle2 className="h-4 w-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                      </div>
                      <CardTitle className="text-xs sm:text-sm font-medium truncate">{t("dashboard.kpi.tasksCompleted")}</CardTitle>
                    </div>
                    {!tasksLoading && !tasksError && tasksData && tasksData.totalTasks > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help flex-shrink-0 ml-1 hover:text-foreground transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-sm">{t("dashboard.kpi.tooltipTotalTasks")}: {tasksData.totalTasks}</p>
                            <p className="text-xs text-muted-foreground">
                              {t("dashboard.kpi.tooltipPendingTasks")}: {tasksData.pendingTasks || 0}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-3 sm:px-4 relative">
                  {tasksLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-12" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                  ) : tasksError ? (
                    <p className="text-xs text-muted-foreground">{t("dashboard.kpi.errorLoading")}</p>
                  ) : (
                    <>
                      <motion.div 
                        className="text-2xl sm:text-3xl font-bold text-violet-600 dark:text-violet-400" 
                        data-testid="kpi-tasks-completed"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.4, type: "spring" }}
                      >
                        {tasksData?.completedToday || 0}
                      </motion.div>
                      <p className="text-xs font-medium text-muted-foreground mt-2">
                        {t("dashboard.kpi.tasksToday")}
                      </p>
                      <motion.div 
                        className="flex items-center gap-2 mt-2"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                      >
                        <Badge className="text-[10px] sm:text-xs bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-600">
                          {tasksData?.completedThisWeek || 0} {t("dashboard.kpi.tasksThisWeek")}
                        </Badge>
                      </motion.div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Study Streak KPI */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <Card className="relative overflow-hidden hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-500/5" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-500 to-amber-500 rounded-l-md" />
              <CardHeader className="pb-2 px-3 sm:px-4 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 shadow-sm">
                      <Flame className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                    </div>
                    <CardTitle className="text-xs sm:text-sm font-medium truncate">{t("dashboard.kpi.studyStreak")}</CardTitle>
                  </div>
                  {!streakLoading && !streakError && streakData && streakData.currentStreak > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help flex-shrink-0 ml-1 hover:text-foreground transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">{t("dashboard.kpi.tooltipCurrentStreak")}: {streakData.currentStreak} {t("dashboard.kpi.days")}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("dashboard.kpi.tooltipRecord")}: {streakData.longestStreak} {t("dashboard.kpi.days")}
                          </p>
                          {streakData.hasStudiedToday && (
                            <p className="text-xs text-emerald-500">{t("dashboard.kpi.tooltipToday")}: {streakData.todayMinutes || 0} min</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 relative">
                {streakLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                ) : streakError ? (
                  <p className="text-xs text-muted-foreground">{t("dashboard.kpi.errorLoading")}</p>
                ) : (streakData?.currentStreak || 0) === 0 && (streakData?.longestStreak || 0) === 0 ? (
                  <>
                    <div className="text-2xl sm:text-3xl font-bold text-muted-foreground/50" data-testid="kpi-study-streak">0 {t("dashboard.kpi.days")}</div>
                    <p className="text-xs text-muted-foreground mt-2">{t("dashboard.kpi.emptyStreak")}</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <motion.div 
                        className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400" 
                        data-testid="kpi-study-streak"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.5, type: "spring" }}
                      >
                        {streakData?.currentStreak || 0}
                      </motion.div>
                      <span className="text-xs sm:text-sm font-medium text-muted-foreground">{t("dashboard.kpi.days")}</span>
                    </div>
                    <motion.div 
                      className="flex items-center gap-2 mt-2"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                    >
                      {streakData?.hasStudiedToday ? (
                        <Badge className="text-[10px] sm:text-xs bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t("dashboard.kpi.studiedToday")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] sm:text-xs">
                          {t("dashboard.kpi.notStudiedToday")}
                        </Badge>
                      )}
                    </motion.div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("dashboard.kpi.longestStreak")}: {streakData?.longestStreak || 0}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Anki-style Flashcard Statistics - Premium only */}
        {currentPlan === "premium" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="mb-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5" />
              <CardHeader className="relative">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-violet-500/20 shadow-sm">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  {t("flashcardStats.title")}
                </CardTitle>
                <CardDescription>{t("flashcardStats.subtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="relative">
                {flashcardStatsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-full rounded-lg" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-24 rounded-lg" />
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
                      <motion.div 
                        className="relative overflow-hidden p-4 rounded-lg border border-amber-200 dark:border-amber-800"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-yellow-500/10" />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1 rounded-md bg-gradient-to-br from-amber-500/20 to-yellow-500/20">
                              <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">
                              {t("flashcardStats.dailyAverage")}
                            </span>
                          </div>
                          <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="stat-daily-average">
                            {flashcardStatsData.stats.dailyAverage} {t("flashcardStats.cards")}
                          </div>
                        </div>
                      </motion.div>
                      
                      <motion.div 
                        className="relative overflow-hidden p-4 rounded-lg border border-blue-200 dark:border-blue-800"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-sky-500/10" />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1 rounded-md bg-gradient-to-br from-blue-500/20 to-sky-500/20">
                              <Percent className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">
                              {t("flashcardStats.daysLearned")}
                            </span>
                          </div>
                          <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="stat-days-learned">
                            {flashcardStatsData.stats.daysLearnedPercentage}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {flashcardStatsData.stats.daysLearned} {t("flashcardStats.days")}
                          </div>
                        </div>
                      </motion.div>
                      
                      <motion.div 
                        className="relative overflow-hidden p-4 rounded-lg border border-orange-200 dark:border-orange-800"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-500/10" />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1 rounded-md bg-gradient-to-br from-orange-500/20 to-amber-500/20">
                              <Trophy className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">
                              {t("flashcardStats.longestStreak")}
                            </span>
                          </div>
                          <div className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="stat-longest-streak">
                            {flashcardStatsData.stats.longestStreak} {t("flashcardStats.days")}
                          </div>
                        </div>
                      </motion.div>
                      
                      <motion.div 
                        className="relative overflow-hidden p-4 rounded-lg border border-rose-200 dark:border-rose-800"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9 }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-red-500/10" />
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1 rounded-md bg-gradient-to-br from-rose-500/20 to-red-500/20">
                              <Flame className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">
                              {t("flashcardStats.currentStreak")}
                            </span>
                          </div>
                          <div className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400" data-testid="stat-current-streak">
                            {flashcardStatsData.stats.currentStreak} {t("flashcardStats.days")}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                    
                    {flashcardStatsData.stats.totalCardsReviewed > 0 && (
                      <motion.div 
                        className="text-center text-sm text-muted-foreground"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                      >
                        {t("flashcardStats.totalCards")}: <span className="font-semibold">{flashcardStatsData.stats.totalCardsReviewed.toLocaleString()}</span>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="p-3 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                      <Calendar className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">{t("flashcardStats.empty")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

      </div>
    </div>
  );
}
