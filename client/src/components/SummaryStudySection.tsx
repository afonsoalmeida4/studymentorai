import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GenerateFlashcardsResponse } from "@shared/schema";
import AnkiFlashcardDeck from "./AnkiFlashcardDeck";
import { Loader2, Brain, Sparkles, Calendar, Dumbbell } from "lucide-react";

interface SummaryStudySectionProps {
  summaryId: string;
}

export default function SummaryStudySection({ summaryId }: SummaryStudySectionProps) {
  const { toast } = useToast();
  const [studyMode, setStudyMode] = useState<"spaced" | "practice">("spaced");

  // Fetch existing flashcards
  const { data: flashcardsData, isLoading } = useQuery<GenerateFlashcardsResponse>({
    queryKey: ["/api/flashcards", summaryId],
    staleTime: Infinity, // Prevent immediate refetch after mutation
  });

  // Generate flashcards mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/flashcards", { topicSummaryId: summaryId }) as GenerateFlashcardsResponse;
    },
    onSuccess: (data: GenerateFlashcardsResponse) => {
      if (data.success && data.flashcards) {
        // Set the query data directly - don't invalidate to avoid race condition
        queryClient.setQueryData<GenerateFlashcardsResponse>(["/api/flashcards", summaryId], data);
        
        toast({
          title: "Flashcards gerados com sucesso!",
          description: `${data.flashcards.length} flashcards criados para estudo.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data.error || "Não foi possível gerar flashcards.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao gerar flashcards",
        description: error.message,
      });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  const hasFlashcards = flashcardsData?.flashcards && flashcardsData.flashcards.length > 0;

  if (isLoading) {
    return (
      <Card className="border-2">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">A carregar flashcards...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {!hasFlashcards ? (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">Flashcards de Estudo</CardTitle>
                <CardDescription>
                  Gere flashcards interativos para testar os seus conhecimentos
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              size="lg"
              className="w-full"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              data-testid="button-generate-flashcards"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  A gerar flashcards...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Gerar Flashcards
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Flashcards de Estudo</CardTitle>
                  <CardDescription>
                    {flashcardsData.flashcards?.length || 0} flashcard{(flashcardsData.flashcards?.length || 0) !== 1 ? 's' : ''} disponíve{(flashcardsData.flashcards?.length || 0) !== 1 ? 'is' : 'l'}
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={studyMode === "spaced" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStudyMode("spaced")}
                  data-testid="button-mode-spaced"
                  className="gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Revisão Anki
                </Button>
                <Button
                  variant={studyMode === "practice" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStudyMode("practice")}
                  data-testid="button-mode-practice"
                  className="gap-2"
                >
                  <Dumbbell className="w-4 h-4" />
                  Praticar Tudo
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <AnkiFlashcardDeck summaryId={summaryId} mode={studyMode} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
