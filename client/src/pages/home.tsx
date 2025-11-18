import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, BookOpen, Brain, Sparkles, ArrowRight, Plus, FileText } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Subject, Topic } from "@shared/schema";

export default function Home() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    select: (data: any) => data.subjects || [],
  });

  const { data: allTopics = [] } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
    queryFn: async () => {
      const res = await fetch("/api/topics");
      if (!res.ok) throw new Error("Failed to fetch topics");
      const data = await res.json();
      return data.topics || [];
    },
  });

  const recentTopics = allTopics.slice(0, 5);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10">
              <GraduationCap className="w-10 h-10 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            {t('home.title')}
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            {t('home.subtitle')}
          </p>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('home.description')}
          </p>
        </div>

        {/* Stats Overview */}
        {subjects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-foreground">{subjects.length}</div>
                <p className="text-sm text-muted-foreground">{t('home.stats.subjects')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-foreground">{allTopics.length}</div>
                <p className="text-sm text-muted-foreground">{t('home.stats.topics')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-foreground">2</div>
                <p className="text-sm text-muted-foreground">{t('home.stats.aiModes')}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/subjects")} data-testid="card-subjects">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <BookOpen className="w-6 h-6 text-blue-500" />
                </div>
                <CardTitle className="text-lg">{t('home.cards.subjects.title')}</CardTitle>
              </div>
              <CardDescription>
                {subjects.length === 0 
                  ? t('home.cards.subjects.empty')
                  : t('home.cards.subjects.count_other', { count: subjects.length })
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                {subjects.length === 0 ? t('home.cards.subjects.createButton') : t('home.cards.subjects.viewButton')}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/chat")} data-testid="card-chat">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Brain className="w-6 h-6 text-purple-500" />
                </div>
                <CardTitle className="text-lg">{t('home.cards.aiMentor.title')}</CardTitle>
              </div>
              <CardDescription>
                {t('home.cards.aiMentor.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                {t('home.cards.aiMentor.button')}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Sparkles className="w-6 h-6 text-amber-500" />
                </div>
                <CardTitle className="text-lg">{t('home.cards.summaries.title')}</CardTitle>
              </div>
              <CardDescription>
                {t('home.cards.summaries.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t('home.cards.summaries.detail')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Topics */}
        <Card>
            <CardHeader>
              <CardTitle>{t('home.recentTopics.title')}</CardTitle>
              <CardDescription>
                {t('home.recentTopics.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentTopics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">{t('home.recentTopics.empty')}</p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setLocation("/subjects")}
                  >
                    {t('home.recentTopics.createFirst')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTopics.map((topic) => {
                    const subject = subjects.find(s => s.id === topic.subjectId);
                    return (
                      <div
                        key={topic.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover-elevate cursor-pointer"
                        onClick={() => setLocation(`/topic/${topic.id}`)}
                        data-testid={`recent-topic-${topic.id}`}
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: subject?.color ?? "#6366f1" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{topic.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {subject?.name ?? t('home.stats.subjects')}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
