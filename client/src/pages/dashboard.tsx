import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Flame, Target, TrendingUp, FileText, Clock, CheckCircle2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { GetDashboardStatsResponse, GetReviewPlanResponse } from "@shared/schema";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Dashboard() {
  const { data: statsData, isLoading: statsLoading } = useQuery<GetDashboardStatsResponse>({
    queryKey: ["/api/dashboard-stats"],
  });

  const { data: reviewData, isLoading: reviewLoading } = useQuery<GetReviewPlanResponse>({
    queryKey: ["/api/review-plan"],
  });

  const stats = statsData?.stats;
  const reviewPlan = reviewData?.reviewPlan || [];
  const aiRecommendation = reviewData?.aiRecommendation;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="title-dashboard">Dashboard de Estudo</h1>
          <p className="text-muted-foreground">Acompanhe o seu progresso e receba recomendações personalizadas</p>
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
                  <CardTitle className="text-sm font-medium">PDFs Estudados</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-pdfs-studied">{stats?.totalPDFsStudied || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Flashcards Completados</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-flashcards-completed">{stats?.totalFlashcardsCompleted || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Dias Consecutivos</CardTitle>
                  <Flame className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-study-streak">{stats?.studyStreak || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.studyStreak && stats.studyStreak > 0 ? "Continue assim!" : "Comece hoje!"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Precisão Média</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-average-accuracy">
                    {stats?.averageAccuracy ? `${stats.averageAccuracy.toFixed(1)}%` : "0%"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {stats?.recentSessions && stats.recentSessions.length > 0 && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Progresso dos Últimos 7 Dias</CardTitle>
                  <CardDescription>Flashcards completados por dia</CardDescription>
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
                        name="Flashcards"
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
                    PDFs Estudados
                  </CardTitle>
                  <CardDescription>Histórico dos seus documentos</CardDescription>
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
                                {pdf.totalSessions} {pdf.totalSessions === 1 ? 'sessão' : 'sessões'}
                              </span>
                              {pdf.averageAccuracy > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {pdf.averageAccuracy.toFixed(0)}% precisão
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Última: {formatDistanceToNow(new Date(pdf.lastStudied), { addSuffix: true, locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">Nenhum PDF estudado ainda</p>
                      <Link href="/">
                        <Button variant="outline" size="sm" className="mt-3" data-testid="button-upload-first-pdf">
                          Carregar primeiro PDF
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
                    Sessões Recentes
                  </CardTitle>
                  <CardDescription>Últimas atividades de estudo</CardDescription>
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
                              {formatDistanceToNow(new Date(session.studyDate), { addSuffix: true, locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">Nenhuma sessão de estudo ainda</p>
                      <Link href="/">
                        <Button variant="outline" size="sm" className="mt-3" data-testid="button-start-first-session">
                          Começar a estudar
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
              <CardTitle>Plano de Revisão Personalizado</CardTitle>
              <CardDescription>Recomendações geradas por IA com base no seu histórico</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {aiRecommendation && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm" data-testid="text-ai-recommendation">{aiRecommendation}</p>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="font-semibold">Tópicos Prioritários</h3>
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
                          {item.priority === 'high' ? 'Alta' : item.priority === 'medium' ? 'Média' : 'Baixa'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{item.recommendation}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Precisão: {item.accuracy.toFixed(1)}%</span>
                        <span>Última sessão: {new Date(item.lastStudied).toLocaleDateString('pt-PT')}</span>
                      </div>
                    </div>
                    <Link href="/home">
                      <Button size="sm" variant="outline" data-testid={`button-review-${index}`}>
                        Revisar
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
              <CardTitle>Plano de Revisão</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Complete algumas sessões de estudo para receber recomendações personalizadas!
              </p>
              <Link href="/home">
                <Button className="mt-4" data-testid="button-start-studying">
                  Começar a Estudar
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
