import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useSubscription } from "@/hooks/useSubscription";
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
  const { subscription } = useSubscription();
  const isPremium = subscription?.plan === "premium";

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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 overflow-x-hidden min-w-0">
      <div className="max-w-5xl mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6 md:py-10 lg:py-12 min-w-0">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 sm:mb-8 md:mb-10"
        >
          <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-violet-600 blur-md opacity-50 rounded-xl" />
              <div className="relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-primary to-violet-600 shadow-lg shadow-primary/25">
                <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground truncate" data-testid="title-home-welcome">
                {firstName ? t('home.welcomeBack', { name: firstName }) : t('home.title')}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">
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
            className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6 md:mb-8"
          >
            <Link href="/subjects">
              <Card className="relative overflow-hidden hover:shadow-lg cursor-pointer group h-full transition-all duration-300 hover:-translate-y-0.5" data-testid="stat-card-subjects">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/5" />
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-l-md" />
                <CardContent className="relative p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-1 sm:mb-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                      <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                    </div>
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">{subjects.length}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{t('home.stats.subjects')}</p>
                </CardContent>
              </Card>
            </Link>
            
            <Card className="relative overflow-hidden h-full" data-testid="stat-card-topics">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/5" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-l-md" />
              <CardContent className="relative p-3 sm:p-4">
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                    <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-foreground">{allTopics.length}</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{t('home.stats.topics')}</p>
              </CardContent>
            </Card>
            
            {isPremium && (
              <Link href="/chat">
                <Card className="relative overflow-hidden hover:shadow-lg cursor-pointer group h-full transition-all duration-300 hover:-translate-y-0.5" data-testid="stat-card-chat">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-purple-500/5" />
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-purple-500 rounded-l-md" />
                  <CardContent className="relative p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-1 sm:mb-2">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                        <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-violet-500" />
                      </div>
                      <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-foreground">2</div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{t('home.stats.aiModes')}</p>
                  </CardContent>
                </Card>
              </Link>
            )}
            
            <Link href="/flashcards">
              <Card className="relative overflow-hidden hover:shadow-lg cursor-pointer group h-full transition-all duration-300 hover:-translate-y-0.5" data-testid="stat-card-flashcards">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/5" />
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500 to-orange-500 rounded-l-md" />
                <CardContent className="relative p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-1 sm:mb-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                    </div>
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                  </div>
                  <div className="text-xl sm:text-3xl font-bold text-foreground">SM-2</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{t('home.stats.flashcards')}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8"
        >
          <Card 
            className="relative overflow-hidden hover:shadow-lg cursor-pointer group transition-all duration-300 hover:-translate-y-0.5" 
            onClick={() => setLocation("/subjects")} 
            data-testid="card-subjects"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5" />
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-l-md" />
            <CardContent className="relative p-3 sm:p-4 md:p-5">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex-shrink-0">
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">{t('home.cards.subjects.title')}</h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    {subjects.length === 0 
                      ? t('home.cards.subjects.empty')
                      : t('home.cards.subjects.count_other', { count: subjects.length })
                    }
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all flex-shrink-0 hidden sm:block" />
              </div>
              {subjects.length === 0 ? (
                <Button size="sm" className="w-full text-xs sm:text-sm bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600" data-testid="button-create-first-subject">
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  {t('home.cards.subjects.createButton')}
                </Button>
              ) : (
                <div className="flex flex-wrap gap-1 sm:gap-1.5">
                  {subjects.slice(0, 2).map((subject) => (
                    <Badge 
                      key={subject.id} 
                      variant="secondary" 
                      className="text-[10px] sm:text-xs font-normal max-w-[120px] sm:max-w-none"
                      style={{ 
                        backgroundColor: subject.color ? `${subject.color}20` : undefined,
                        borderColor: subject.color || undefined,
                        borderWidth: subject.color ? '1px' : undefined
                      }}
                    >
                      <span 
                        className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full mr-1 sm:mr-1.5 flex-shrink-0"
                        style={{ backgroundColor: subject.color || '#6366f1' }}
                      />
                      <span className="truncate">{subject.name}</span>
                    </Badge>
                  ))}
                  {subjects.length > 2 && (
                    <Badge variant="outline" className="text-[10px] sm:text-xs font-normal">
                      +{subjects.length - 2}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {isPremium && (
            <Card 
              className="relative overflow-hidden hover:shadow-lg cursor-pointer group transition-all duration-300 hover:-translate-y-0.5" 
              onClick={() => setLocation("/chat")} 
              data-testid="card-chat"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-500/5" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-purple-500 rounded-l-md" />
              <CardContent className="relative p-3 sm:p-4 md:p-5">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex-shrink-0">
                    <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">{t('home.cards.aiMentor.title')}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      {t('home.cards.aiMentor.description')}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all flex-shrink-0 hidden sm:block" />
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <Badge variant="secondary" className="text-[10px] sm:text-xs font-normal bg-blue-500/10 border border-blue-500/20">
                    <BookOpen className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                    {t('chat.studyMode')}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] sm:text-xs font-normal bg-amber-500/10 border border-amber-500/20">
                    <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                    {t('chat.existentialMode')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {recentTopics.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card>
              <CardHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 pb-2 sm:pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                    <CardTitle className="text-sm sm:text-base truncate">{t('home.recentTopics.title')}</CardTitle>
                  </div>
                  <Link href="/subjects">
                    <Button variant="ghost" size="sm" className="text-[10px] sm:text-xs h-6 sm:h-7 px-2 sm:px-3 flex-shrink-0" data-testid="button-view-all-subjects">
                      <span className="hidden xs:inline">{t('home.recentTopics.viewAll')}</span>
                      <ArrowRight className="w-3 h-3 ml-0 xs:ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 md:px-6 pt-0 pb-3 sm:pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                  {recentTopics.map((topic) => {
                    const subject = subjects.find(s => s.id === topic.subjectId);
                    return (
                      <div
                        key={topic.id}
                        className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg hover-elevate cursor-pointer border border-transparent hover:border-border transition-colors"
                        onClick={() => setLocation(`/topic/${topic.id}`)}
                        data-testid={`recent-topic-${topic.id}`}
                      >
                        <div
                          className="w-1.5 sm:w-2 h-6 sm:h-8 rounded-full flex-shrink-0"
                          style={{ backgroundColor: subject?.color ?? "#6366f1" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm truncate text-foreground">{topic.name}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                            {subject?.name ?? t('home.stats.subjects')}
                          </p>
                        </div>
                        <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
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
              <CardContent className="py-8 sm:py-10 md:py-12 px-4 sm:px-6">
                <div className="text-center">
                  <div className="flex justify-center mb-3 sm:mb-4">
                    <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-primary/10 border border-primary/20">
                      <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2">{t('home.empty.title')}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-sm sm:max-w-md mx-auto mb-4 sm:mb-6 px-2">
                    {t('home.empty.description')}
                  </p>
                  <Button onClick={() => setLocation("/subjects")} className="text-sm" data-testid="button-get-started">
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
