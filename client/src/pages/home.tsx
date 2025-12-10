import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  GraduationCap, 
  BookOpen, 
  Brain, 
  Sparkles, 
  ArrowRight, 
  Plus, 
  FileText,
  FolderOpen,
  MessageSquare,
  Layers,
  Clock,
  ChevronRight,
  Zap
} from "lucide-react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Subject, Topic } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";

interface AuthUser {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth() as { user: AuthUser | null };

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

  const recentTopics = allTopics.slice(0, 4);
  const hasContent = subjects.length > 0 || allTopics.length > 0;
  const firstName = user?.firstName || user?.email?.split('@')[0] || '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="title-home-welcome">
                {firstName ? t('home.welcomeBack', { name: firstName }) : t('home.title')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('home.subtitle')}
              </p>
            </div>
          </div>
        </motion.div>

        {hasContent && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
          >
            <Link href="/subjects">
              <Card className="hover-elevate cursor-pointer group border-l-4 border-l-blue-500" data-testid="stat-card-subjects">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <FolderOpen className="w-5 h-5 text-blue-500" />
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">{subjects.length}</div>
                  <p className="text-xs text-muted-foreground">{t('home.stats.subjects')}</p>
                </CardContent>
              </Card>
            </Link>
            
            <Card className="border-l-4 border-l-green-500" data-testid="stat-card-topics">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Layers className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-3xl font-bold text-foreground">{allTopics.length}</div>
                <p className="text-xs text-muted-foreground">{t('home.stats.topics')}</p>
              </CardContent>
            </Card>
            
            <Link href="/chat">
              <Card className="hover-elevate cursor-pointer group border-l-4 border-l-purple-500" data-testid="stat-card-chat">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <MessageSquare className="w-5 h-5 text-purple-500" />
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">2</div>
                  <p className="text-xs text-muted-foreground">{t('home.stats.aiModes')}</p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/flashcards">
              <Card className="hover-elevate cursor-pointer group border-l-4 border-l-amber-500" data-testid="stat-card-flashcards">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">SM-2</div>
                  <p className="text-xs text-muted-foreground">{t('home.stats.flashcards')}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
        >
          <Card 
            className="hover-elevate cursor-pointer group overflow-hidden" 
            onClick={() => setLocation("/subjects")} 
            data-testid="card-subjects"
          >
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-2 bg-gradient-to-b from-blue-500 to-blue-600" />
                <div className="flex-1 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <BookOpen className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{t('home.cards.subjects.title')}</h3>
                      <p className="text-xs text-muted-foreground">
                        {subjects.length === 0 
                          ? t('home.cards.subjects.empty')
                          : t('home.cards.subjects.count_other', { count: subjects.length })
                        }
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                  </div>
                  {subjects.length === 0 ? (
                    <Button size="sm" className="w-full" data-testid="button-create-first-subject">
                      <Plus className="w-4 h-4 mr-2" />
                      {t('home.cards.subjects.createButton')}
                    </Button>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {subjects.slice(0, 3).map((subject) => (
                        <Badge 
                          key={subject.id} 
                          variant="secondary" 
                          className="text-xs font-normal"
                          style={{ 
                            backgroundColor: subject.color ? `${subject.color}20` : undefined,
                            borderColor: subject.color || undefined,
                            borderWidth: subject.color ? '1px' : undefined
                          }}
                        >
                          <span 
                            className="w-1.5 h-1.5 rounded-full mr-1.5"
                            style={{ backgroundColor: subject.color || '#6366f1' }}
                          />
                          {subject.name}
                        </Badge>
                      ))}
                      {subjects.length > 3 && (
                        <Badge variant="outline" className="text-xs font-normal">
                          +{subjects.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="hover-elevate cursor-pointer group overflow-hidden" 
            onClick={() => setLocation("/chat")} 
            data-testid="card-chat"
          >
            <CardContent className="p-0">
              <div className="flex items-stretch">
                <div className="w-2 bg-gradient-to-b from-purple-500 to-purple-600" />
                <div className="flex-1 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                      <Brain className="w-5 h-5 text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{t('home.cards.aiMentor.title')}</h3>
                      <p className="text-xs text-muted-foreground">
                        {t('home.cards.aiMentor.description')}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-xs font-normal bg-blue-500/10 border border-blue-500/20">
                      <BookOpen className="w-3 h-3 mr-1" />
                      {t('chat.studyMode')}
                    </Badge>
                    <Badge variant="secondary" className="text-xs font-normal bg-amber-500/10 border border-amber-500/20">
                      <Sparkles className="w-3 h-3 mr-1" />
                      {t('chat.existentialMode')}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {recentTopics.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-base">{t('home.recentTopics.title')}</CardTitle>
                  </div>
                  <Link href="/subjects">
                    <Button variant="ghost" size="sm" className="text-xs h-7" data-testid="button-view-all-subjects">
                      {t('home.recentTopics.viewAll')}
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {recentTopics.map((topic) => {
                    const subject = subjects.find(s => s.id === topic.subjectId);
                    return (
                      <div
                        key={topic.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover-elevate cursor-pointer border border-transparent hover:border-border transition-colors"
                        onClick={() => setLocation(`/topic/${topic.id}`)}
                        data-testid={`recent-topic-${topic.id}`}
                      >
                        <div
                          className="w-2 h-8 rounded-full flex-shrink-0"
                          style={{ backgroundColor: subject?.color ?? "#6366f1" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate text-foreground">{topic.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {subject?.name ?? t('home.stats.subjects')}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!hasContent && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="border-dashed">
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
                      <FileText className="w-8 h-8 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{t('home.empty.title')}</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                    {t('home.empty.description')}
                  </p>
                  <Button onClick={() => setLocation("/subjects")} data-testid="button-get-started">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('home.empty.button')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
