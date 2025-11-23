import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { BookOpen, Flame, Target, TrendingUp, TrendingDown, Minus, FileText, Clock, CheckCircle2, ArrowUp, ArrowDown, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import type { GetDashboardStatsResponse, GetReviewPlanResponse } from "@shared/schema";
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

  const { data: reviewData, isLoading: reviewLoading } = useQuery<GetReviewPlanResponse>({
    queryKey: ["/api/review-plan"],
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

  const hasAnyKpiError = studyTimeError || subjectProgressError || tasksError || streakError;

  if (!subscriptionResolved || currentPlan === "free") {
    return null;
  }

  const stats = statsData?.stats;
  const reviewPlan = reviewData?.reviewPlan || [];
  const aiRecommendation = reviewData?.aiRecommendation;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="title-dashboard">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>

        <div className="mb-6">
          <GamificationHeader />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* Weekly Study Hours KPI - Spans 2 columns for emphasis */}
          <Card className="hover-elevate transition-all duration-300 border-l-4 border-l-blue-500 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.kpi.weeklyHours")}</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <Clock className="h-6 w-6 text-blue-500" />
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
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
            <CardContent>
              {studyTimeLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : studyTimeError ? (
                <p className="text-xs text-muted-foreground">{t("dashboard.kpi.errorLoading")}</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <div className={`text-3xl font-bold ${(studyTimeData?.currentWeekMinutes || 0) === 0 ? 'text-muted-foreground' : ''}`} data-testid="kpi-weekly-hours">
                      {studyTimeData?.currentWeekHours || "0.0"}h
                    </div>
                  </div>
                  {studyTimeData?.deltaMinutes !== undefined && studyTimeData.deltaMinutes !== 0 && (
                    <div className={`flex items-center gap-1 text-sm font-semibold ${getDeltaColor(studyTimeData.deltaMinutes)} mt-1`}>
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
                    <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
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
          {currentPlan === "premium" && (
            <Card className="hover-elevate transition-all duration-300 border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.kpi.subjectProgress")}</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <Target className="h-6 w-6 text-green-500" />
                      {!subjectProgressLoading && !subjectProgressError && subjectProgressData?.subjects && subjectProgressData.subjects.length > 0 && (
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      )}
                    </div>
                  </TooltipTrigger>
                  {subjectProgressData?.subjects && subjectProgressData.subjects.length > 0 && (
                    <TooltipContent>
                      <p className="text-sm font-semibold">{subjectProgressData.subjects[0].subjectName}</p>
                      <p className="text-xs text-muted-foreground">
                        {subjectProgressData.subjects[0].completedTopics} de {subjectProgressData.subjects[0].totalTopics} {t("dashboard.kpi.tooltipSubjectDetails")}
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent>
              {subjectProgressLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : subjectProgressError ? (
                <p className="text-xs text-muted-foreground">{t("dashboard.kpi.errorLoading")}</p>
              ) : !subjectProgressData?.subjects || subjectProgressData.subjects.length === 0 ? (
                <>
                  <div className="text-3xl font-bold text-muted-foreground animate-pulse" data-testid="kpi-subject-progress">0%</div>
                  <p className="text-xs text-muted-foreground mt-2">{t("dashboard.kpi.emptySubjects")}</p>
                  <Link href="/">
                    <Button variant="ghost" size="sm" className="mt-3 h-8 text-xs hover-elevate" data-testid="button-create-subject">
                      {t("dashboard.kpi.createFirst")}
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <div className={`text-3xl font-bold ${getProgressColor(subjectProgressData.subjects[0].completionPercentage)}`} data-testid="kpi-subject-progress">
                    {subjectProgressData.subjects[0].completionPercentage}%
                  </div>
                  <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-500" 
                      style={{ width: `${subjectProgressData.subjects[0].completionPercentage}%` }}
                    />
                  </div>
                  <p className="text-xs font-medium mt-2 truncate">
                    {subjectProgressData.subjects[0].subjectName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {subjectProgressData.subjects[0].completedTopics}/{subjectProgressData.subjects[0].totalTopics} {t("dashboard.kpi.topicsCompleted")}
                  </p>
                </>
              )}
            </CardContent>
            </Card>
          )}

          {/* Tasks Completed KPI - Premium only, and only if there are tasks */}
          {currentPlan === "premium" && !tasksLoading && !tasksError && tasksData && tasksData.totalTasks > 0 && (
            <Card className="hover-elevate transition-all duration-300 border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.kpi.tasksCompleted")}</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-6 w-6 text-purple-500" />
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">{t("dashboard.kpi.tooltipTotalTasks")}: {tasksData.totalTasks}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("dashboard.kpi.tooltipPendingTasks")}: {tasksData.pendingTasks || 0}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400" data-testid="kpi-tasks-completed">
                {tasksData.completedToday || 0}
              </div>
              <p className="text-xs font-medium text-muted-foreground mt-2">
                {t("dashboard.kpi.tasksToday")}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {tasksData.completedThisWeek || 0} {t("dashboard.kpi.tasksThisWeek")}
                </Badge>
              </div>
            </CardContent>
            </Card>
          )}

          {/* Study Streak KPI */}
          <Card className="hover-elevate transition-all duration-300 border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.kpi.studyStreak")}</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <Flame className="h-6 w-6 text-orange-500" />
                      {!streakLoading && !streakError && streakData && streakData.currentStreak > 0 && (
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
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
            <CardContent>
              {streakLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : streakError ? (
                <p className="text-xs text-muted-foreground">{t("dashboard.kpi.errorLoading")}</p>
              ) : (streakData?.currentStreak || 0) === 0 && (streakData?.longestStreak || 0) === 0 ? (
                <>
                  <div className="text-3xl font-bold text-muted-foreground animate-pulse" data-testid="kpi-study-streak">0 {t("dashboard.kpi.days")}</div>
                  <p className="text-xs text-muted-foreground mt-2">{t("dashboard.kpi.emptyStreak")}</p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-bold text-orange-600 dark:text-orange-400" data-testid="kpi-study-streak">
                      {streakData?.currentStreak || 0}
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{t("dashboard.kpi.days")}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {streakData?.hasStudiedToday ? (
                      <Badge variant="default" className="text-xs bg-green-600 dark:bg-green-500">
                        ✓ {t("dashboard.kpi.studiedToday")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        {t("dashboard.kpi.notStudiedToday")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("dashboard.kpi.longestStreak")}: {streakData?.longestStreak || 0}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {reviewLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ) : reviewPlan.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.review.title")}</CardTitle>
              <CardDescription>{t("dashboard.review.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {aiRecommendation && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm" data-testid="text-ai-recommendation">{aiRecommendation}</p>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="font-semibold">{t("dashboard.review.priorities")}</h3>
                {reviewPlan.map((item, index) => (
                  <div key={item.summaryId} className="flex items-start justify-between gap-4 p-4 border rounded-lg hover-elevate" data-testid={`review-item-${index}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{item.fileName}</h4>
                        <Badge variant={
                          item.priority === 'high' ? 'destructive' : 
                          item.priority === 'medium' ? 'default' : 
                          'secondary'
                        }>
                          {item.priority === 'high' ? t("dashboard.review.priorityHigh") : item.priority === 'medium' ? t("dashboard.review.priorityMedium") : t("dashboard.review.priorityLow")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{item.recommendation}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{t("dashboard.review.accuracy", { percent: item.accuracy.toFixed(1) })}</span>
                        <span>{t("dashboard.review.lastSession", { date: new Date(item.lastStudied).toLocaleDateString(i18n.language === 'pt' ? 'pt-PT' : i18n.language === 'en' ? 'en-US' : i18n.language) })}</span>
                      </div>
                    </div>
                    <Link href="/">
                      <Button size="sm" variant="outline" data-testid={`button-review-${index}`}>
                        {t("dashboard.review.reviewButton")}
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.review.emptyTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {t("dashboard.review.emptyMessage")}
              </p>
              <Link href="/">
                <Button className="mt-4" data-testid="button-start-studying">
                  {t("dashboard.review.startButton")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
