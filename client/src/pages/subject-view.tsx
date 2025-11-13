import { useState } from "react";
import { useParams } from "wouter";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import type { Subject, Topic } from "@shared/schema";

export default function SubjectView() {
  const params = useParams<{ id?: string }>();
  const subjectId = params.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isTopicDialogOpen, setIsTopicDialogOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicDescription, setNewTopicDescription] = useState("");

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    select: (data: any) => data.subjects || [],
  });

  const { data: topics = [] } = useQuery<Topic[]>({
    queryKey: ["/api/topics", subjectId],
    queryFn: async () => {
      if (!subjectId) return [];
      const res = await fetch(`/api/topics?subjectId=${subjectId}`);
      if (!res.ok) throw new Error("Failed to fetch topics");
      const data = await res.json();
      return data.topics || [];
    },
    enabled: !!subjectId,
  });

  const currentSubject = subjects.find((s) => s.id === subjectId);

  const createTopicMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/topics", "POST", {
        subjectId,
        name: newTopicName,
        description: newTopicDescription,
        position: topics.length,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", subjectId] });
      setIsTopicDialogOpen(false);
      setNewTopicName("");
      setNewTopicDescription("");
      toast({
        title: "Tópico criado!",
        description: "O seu novo tópico foi adicionado com sucesso.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível criar o tópico.",
      });
    },
  });

  const handleCreateTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTopicName.trim()) {
      createTopicMutation.mutate();
    }
  };

  if (!subjectId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Bem-vindo</h1>
          <p className="text-muted-foreground">
            Selecione uma disciplina na barra lateral para começar a organizar o seu conhecimento.
          </p>
        </div>

        {subjects.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Nenhuma disciplina criada</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Comece criando a sua primeira disciplina para organizar tópicos de estudo.
                </p>
                <p className="text-sm text-muted-foreground">
                  Clique no botão + na barra lateral.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {subjects.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <Card
                key={subject.id}
                className="hover-elevate active-elevate-2 cursor-pointer"
                onClick={() => setLocation(`/subject/${subject.id}`)}
                data-testid={`card-subject-${subject.id}`}
              >
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: subject.color ?? "#6366f1" }}
                    />
                    <CardTitle className="text-lg">{subject.name}</CardTitle>
                  </div>
                  {subject.description && (
                    <CardDescription>{subject.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-5 h-5 rounded"
              style={{ backgroundColor: currentSubject?.color ?? "#6366f1" }}
            />
            <h1 className="text-3xl font-semibold">{currentSubject?.name || "Disciplina"}</h1>
          </div>
          {currentSubject?.description && (
            <p className="text-muted-foreground">{currentSubject.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-medium">Tópicos</h2>
          <Button
            onClick={() => setIsTopicDialogOpen(true)}
            data-testid="button-add-topic"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Tópico
          </Button>
        </div>

        {topics.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Nenhum tópico criado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie tópicos para organizar os seus materiais de estudo.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setIsTopicDialogOpen(true)}
                  data-testid="button-create-first-topic"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Tópico
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <Card
                key={topic.id}
                className="hover-elevate active-elevate-2 cursor-pointer"
                onClick={() => setLocation(`/topic/${topic.id}`)}
                data-testid={`card-topic-${topic.id}`}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{topic.name}</CardTitle>
                  {topic.description && (
                    <CardDescription>{topic.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isTopicDialogOpen} onOpenChange={setIsTopicDialogOpen}>
        <DialogContent data-testid="dialog-create-topic">
          <form onSubmit={handleCreateTopic}>
            <DialogHeader>
              <DialogTitle>Novo Tópico</DialogTitle>
              <DialogDescription>
                Crie um novo tópico dentro de {currentSubject?.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="topic-name">Nome</Label>
                <Input
                  id="topic-name"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  placeholder="Ex: Álgebra Linear"
                  data-testid="input-topic-name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="topic-description">Descrição (opcional)</Label>
                <Textarea
                  id="topic-description"
                  value={newTopicDescription}
                  onChange={(e) => setNewTopicDescription(e.target.value)}
                  placeholder="Breve descrição..."
                  data-testid="input-topic-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTopicDialogOpen(false)}
                data-testid="button-cancel-topic"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!newTopicName.trim() || createTopicMutation.isPending}
                data-testid="button-submit-topic"
              >
                {createTopicMutation.isPending ? "A criar..." : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
