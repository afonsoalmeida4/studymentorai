import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ApiFlashcard } from "@shared/schema";
import { RotateCw, Check } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AnkiFlashcardDeckProps {
  summaryId: string;
}

export default function AnkiFlashcardDeck({ summaryId }: AnkiFlashcardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const { toast } = useToast();

  const { data: dueFlashcardsData, isLoading } = useQuery<{ success: boolean; flashcards: ApiFlashcard[] }>({
    queryKey: ["/api/flashcards", summaryId, "due"],
    queryFn: async () => {
      const res = await fetch(`/api/flashcards/${summaryId}/due`);
      if (!res.ok) throw new Error("Erro ao carregar flashcards");
      return res.json();
    },
  });

  const recordAttemptMutation = useMutation({
    mutationFn: async ({ flashcardId, rating }: { flashcardId: string; rating: number }) => {
      return apiRequest("POST", `/api/flashcards/${flashcardId}/attempt`, { rating });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards", summaryId, "due"] });
      setIsFlipped(false);
      setCurrentIndex(prev => prev + 1);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao registar resposta. Tenta novamente.",
        variant: "destructive",
      });
    },
  });

  const flashcards = dueFlashcardsData?.flashcards || [];
  const currentFlashcard = flashcards[currentIndex];
  const completed = currentIndex >= flashcards.length;
  const progress = flashcards.length > 0 ? ((currentIndex / flashcards.length) * 100) : 0;

  const handleRating = (rating: number) => {
    if (!currentFlashcard) return;
    recordAttemptMutation.mutate({
      flashcardId: currentFlashcard.id,
      rating,
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">A carregar flashcards...</p>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <Check className="w-16 h-16 mx-auto text-primary" />
        <div>
          <h3 className="text-xl font-semibold mb-2">Tudo revisto!</h3>
          <p className="text-muted-foreground">
            Não tens flashcards para rever agora. Volta mais tarde!
          </p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="text-center py-12 space-y-4">
        <Check className="w-16 h-16 mx-auto text-primary" />
        <div>
          <h3 className="text-xl font-semibold mb-2">Sessão concluída!</h3>
          <p className="text-muted-foreground">
            Reviste {flashcards.length} flashcard{flashcards.length !== 1 ? 's' : ''}.
          </p>
        </div>
        <Button
          onClick={() => {
            setCurrentIndex(0);
            queryClient.invalidateQueries({ queryKey: ["/api/flashcards", summaryId, "due"] });
          }}
          data-testid="button-restart-study"
        >
          Rever novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2" data-testid="flashcard-progress">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-medium">
            {currentIndex} / {flashcards.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="perspective-1000">
        <div
          className={`relative w-full min-h-96 transition-transform duration-500 transform-style-preserve-3d ${
            isFlipped ? "rotate-y-180" : ""
          }`}
          data-testid={`flashcard-${currentFlashcard.id}`}
        >
          <Card
            className="absolute inset-0 backface-hidden border-2 cursor-pointer hover-elevate"
            onClick={() => !isFlipped && setIsFlipped(true)}
          >
            <CardContent className="flex flex-col h-full justify-between p-8">
              <div className="flex-1 flex items-center justify-center">
                <p
                  className="text-2xl font-medium text-center"
                  data-testid={`question-${currentFlashcard.id}`}
                >
                  {currentFlashcard.question}
                </p>
              </div>
              <div className="flex items-center justify-between pt-6 border-t">
                <Badge variant="secondary">Pergunta</Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RotateCw className="w-4 h-4" />
                  <span>Clique para ver a resposta</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="absolute inset-0 backface-hidden rotate-y-180 border-2">
            <CardContent className="flex flex-col h-full justify-between p-8">
              <div className="flex-1 flex items-center justify-center">
                <p
                  className="text-xl text-center"
                  data-testid={`answer-${currentFlashcard.id}`}
                >
                  {currentFlashcard.answer}
                </p>
              </div>
              <div className="space-y-4 pt-6 border-t">
                <Badge variant="default" className="mb-2">Resposta</Badge>
                <p className="text-sm text-muted-foreground mb-4">
                  Como foi a tua resposta?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleRating(1)}
                    disabled={recordAttemptMutation.isPending}
                    variant="outline"
                    className="border-red-500/50 hover:bg-red-500/10"
                    data-testid="button-again"
                  >
                    <span className="text-red-600 dark:text-red-400">Novamente</span>
                  </Button>
                  <Button
                    onClick={() => handleRating(2)}
                    disabled={recordAttemptMutation.isPending}
                    variant="outline"
                    className="border-orange-500/50 hover:bg-orange-500/10"
                    data-testid="button-hard"
                  >
                    <span className="text-orange-600 dark:text-orange-400">Difícil</span>
                  </Button>
                  <Button
                    onClick={() => handleRating(3)}
                    disabled={recordAttemptMutation.isPending}
                    variant="outline"
                    className="border-green-500/50 hover:bg-green-500/10"
                    data-testid="button-good"
                  >
                    <span className="text-green-600 dark:text-green-400">Bom</span>
                  </Button>
                  <Button
                    onClick={() => handleRating(4)}
                    disabled={recordAttemptMutation.isPending}
                    variant="outline"
                    className="border-blue-500/50 hover:bg-blue-500/10"
                    data-testid="button-easy"
                  >
                    <span className="text-blue-600 dark:text-blue-400">Fácil</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
