import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Flame, Target, TrendingUp, FileText, Clock, CheckCircle2, Crown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { GetDashboardStatsResponse, GetReviewPlanResponse } from "@shared/schema";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es, fr, de, it, type Locale } from "date-fns/locale";
import { GamificationHeader } from "@/components/GamificationHeader";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";

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

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const dateLocale = useMemo(() => getDateFnsLocale(i18n.language), [i18n.language]);
  const { data: statsData, isLoading: statsLoading } = useQuery<GetDashboardStatsResponse>({
    queryKey: ["/api/dashboard-stats"],
  });

  const { data: reviewData, isLoading: reviewLoading } = useQuery<GetReviewPlanResponse>({
    queryKey: ["/api/review-plan"],
  });

  const stats = statsData?.stats;
  const reviewPlan = reviewData?.reviewPlan || [];
  const aiRecommendation = reviewData?.aiRecommendation;

  const activatePremiumMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/premium/activate");
    },
    onSuccess: () => {
      toast({
        title: t("dashboard.premium.activatedTitle"),
        description: t("dashboard.premium.activatedMessage"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/profile"] });
    },
    onError: () => {
      toast({
        title: t("dashboard.premium.errorTitle"),
        description: t("dashboard.premium.errorMessage"),
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="title-dashboard">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>

        <div className="mb-6">
          <GamificationHeader />
        </div>

        {statsLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("dashboard.stats.pdfsStudied")}</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-pdfs-studied">{stats?.totalPDFsStudied || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("dashboard.stats.flashcardsCompleted")}</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-flashcards-completed">{stats?.totalFlashcardsCompleted || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("dashboard.stats.studyStreak")}</CardTitle>
                  <Flame className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-study-streak">{stats?.studyStreak || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.studyStreak && stats.studyStreak > 0 ? t("dashboard.stats.keepGoing") : t("dashboard.stats.startToday")}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t("dashboard.stats.averageAccuracy")}</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-average-accuracy">
                    {stats?.averageAccuracy ? `${stats.averageAccuracy.toFixed(1)}%` : "0%"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Premium Upgrade Card */}
            <Card className="mb-8 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/20 dark:to-amber-900/20 border-amber-200 dark:border-amber-800" data-testid="card-premium-upgrade">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <CardTitle className="text-amber-900 dark:text-amber-100">
                    {t("dashboard.premium.unlock")}
                  </CardTitle>
                </div>
                <CardDescription className="text-amber-800 dark:text-amber-300">
                  {t("dashboard.premium.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => activatePremiumMutation.mutate()}
                  disabled={activatePremiumMutation.isPending}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  data-testid="button-activate-premium"
                >
                  {activatePremiumMutation.isPending ? t("dashboard.premium.activating") : t("dashboard.premium.activate")}
                </Button>
              </CardContent>
            </Card>

            {stats?.recentSessions && stats.recentSessions.length > 0 && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>{t("dashboard.progress.title")}</CardTitle>
                  <CardDescription>{t("dashboard.progress.subtitle")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats.recentSessions}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="flashcardsCompleted" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        name={t("dashboard.progress.flashcardsLabel")}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Studied PDFs and Recent Sessions Section */}
            <div className="grid gap-6 md:grid-cols-2 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {t("dashboard.pdfs.title")}
                  </CardTitle>
                  <CardDescription>{t("dashboard.pdfs.subtitle")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats?.studiedPDFs && stats.studiedPDFs.length > 0 ? (
                    <div className="space-y-3">
                      {stats.studiedPDFs.slice(0, 5).map((pdf) => (
                        <div key={pdf.id} className="flex items-start justify-between gap-3 p-3 border rounded-lg hover-elevate" data-testid={`pdf-item-${pdf.id}`}>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate" title={pdf.fileName}>{pdf.fileName}</h4>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {pdf.learningStyle}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {pdf.totalSessions} {t(`dashboard.pdfs.sessions_${pdf.totalSessions === 1 ? 'one' : 'other'}`)}
                              </span>
                              {pdf.averageAccuracy > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {t("dashboard.pdfs.accuracy", { percent: pdf.averageAccuracy.toFixed(0) })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("dashboard.pdfs.lastStudied", { time: formatDistanceToNow(new Date(pdf.lastStudied), { addSuffix: true, locale: dateLocale }) })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">{t("dashboard.pdfs.empty")}</p>
                      <Link href="/">
                        <Button variant="outline" size="sm" className="mt-3" data-testid="button-upload-first-pdf">
                          {t("dashboard.pdfs.uploadFirst")}
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Study Sessions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {t("dashboard.sessions.title")}
                  </CardTitle>
                  <CardDescription>{t("dashboard.sessions.subtitle")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats?.recentStudySessions && stats.recentStudySessions.length > 0 ? (
                    <div className="space-y-3">
                      {stats.recentStudySessions.slice(0, 5).map((session) => (
                        <div key={session.id} className="flex items-start justify-between gap-3 p-3 border rounded-lg hover-elevate" data-testid={`session-item-${session.id}`}>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate text-sm" title={session.fileName}>{session.fileName}</h4>
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                                <span>{session.correctFlashcards}/{session.totalFlashcards}</span>
                              </div>
                              <Badge variant={session.accuracy >= 70 ? "default" : "secondary"} className="text-xs">
                                {session.accuracy.toFixed(0)}%
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(session.studyDate), { addSuffix: true, locale: dateLocale })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">{t("dashboard.sessions.empty")}</p>
                      <Link href="/">
                        <Button variant="outline" size="sm" className="mt-3" data-testid="button-start-first-session">
                          {t("dashboard.sessions.startStudying")}
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

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
                    <Link href="/home">
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
              <Link href="/home">
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
