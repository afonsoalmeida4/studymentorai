import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, BookOpen, Brain, Sparkles, ArrowRight, Plus, FileText } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Subject, Topic } from "@shared/schema";

export default function Home() {
  const [, setLocation] = useLocation();

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
            Bem-vindo ao AI Study Mentor
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            Organiza o teu conhecimento. Encontra o teu equilíbrio.
          </p>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Uma plataforma completa para organizar materiais de estudo, processar documentos com IA e encontrar apoio na tua jornada de aprendizagem.
          </p>
        </div>

        {/* Stats Overview */}
        {subjects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-foreground">{subjects.length}</div>
                <p className="text-sm text-muted-foreground">Disciplinas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-foreground">{allTopics.length}</div>
                <p className="text-sm text-muted-foreground">Tópicos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-foreground">2</div>
                <p className="text-sm text-muted-foreground">Modos AI</p>
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
                <CardTitle className="text-lg">Disciplinas</CardTitle>
              </div>
              <CardDescription>
                {subjects.length === 0 
                  ? "Crie a sua primeira disciplina para começar"
                  : `${subjects.length} disciplina${subjects.length !== 1 ? 's' : ''} criada${subjects.length !== 1 ? 's' : ''}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                {subjects.length === 0 ? "Criar Disciplina" : "Ver Disciplinas"}
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
                <CardTitle className="text-lg">AI Mentor</CardTitle>
              </div>
              <CardDescription>
                Converse em modo Estudo ou Existencial
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                Abrir Chat
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
                <CardTitle className="text-lg">Resumos IA</CardTitle>
              </div>
              <CardDescription>
                Gere resumos personalizados automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Faça upload de PDF, Word ou PowerPoint nos seus tópicos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Topics or Getting Started */}
        {subjects.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Começar</CardTitle>
              <CardDescription>
                Siga estes passos para aproveitar ao máximo o AI Study Mentor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Crie uma Disciplina</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Use a sidebar à esquerda e clique no botão + para criar a sua primeira disciplina
                    </p>
                    <Button 
                      size="sm" 
                      onClick={() => document.querySelector<HTMLButtonElement>('[data-testid="button-add-subject"]')?.click()}
                      data-testid="button-cta-create-subject"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Disciplina
                    </Button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Adicione Tópicos</h3>
                    <p className="text-sm text-muted-foreground">
                      Dentro de cada disciplina, crie tópicos específicos para organizar o conteúdo
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Faça Upload de Materiais</h3>
                    <p className="text-sm text-muted-foreground">
                      Adicione ficheiros (PDF, DOCX, PPTX) ou links externos, com resumo IA opcional
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold flex-shrink-0">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Converse com o AI Mentor</h3>
                    <p className="text-sm text-muted-foreground">
                      Use o modo Estudo para ajuda com conteúdo ou Existencial para motivação
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Tópicos Recentes</CardTitle>
              <CardDescription>
                Os seus tópicos mais recentemente criados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentTopics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Ainda não tem tópicos</p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setLocation("/subjects")}
                  >
                    Criar Primeiro Tópico
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
                            {subject?.name ?? "Disciplina"}
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
        )}
      </div>
    </div>
  );
}
