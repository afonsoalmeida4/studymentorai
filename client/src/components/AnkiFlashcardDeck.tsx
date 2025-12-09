import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ApiFlashcard } from "@shared/schema";
import { RotateCw, Check, Clock } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface AnkiFlashcardDeckProps {
  summaryId: string;
  mode?: "spaced" | "practice";
}

export default function AnkiFlashcardDeck({ summaryId, mode = "spaced" }: AnkiFlashcardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [sessionTotal, setSessionTotal] = useState<number | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  // Resetar progresso quando mudar de modo
  useEffect(() => {
    setCurrentIndex(0);
    setSessionTime(0);
    setIsFlipped(false);
    setSessionTotal(null);
    setCompletedCount(0);
  }, [mode]);

  // Timer de sessão
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const endpoint = mode === "practice" ? "all" : "due";
  const { data: dueFlashcardsData, isLoading } = useQuery<{ 
    success: boolean; 
    flashcards: ApiFlashcard[];
    nextAvailableAt?: string | null;
  }>({
    queryKey: ["/api/flashcards", summaryId, endpoint, i18n.language],
    queryFn: async () => {
      const res = await fetch(`/api/flashcards/${summaryId}/${endpoint}?language=${i18n.language}`);
      if (!res.ok) throw new Error("Erro ao carregar flashcards");
      return res.json();
    },
  });

  const flashcards = dueFlashcardsData?.flashcards || [];

  // Capturar o total inicial quando os flashcards são carregados
  useEffect(() => {
    if (flashcards.length > 0 && sessionTotal === null) {
      setSessionTotal(flashcards.length);
    }
  }, [flashcards.length, sessionTotal]);

  const recordAttemptMutation = useMutation({
    mutationFn: async ({ flashcardId, rating }: { flashcardId: string; rating: number }) => {
      return apiRequest("POST", `/api/flashcards/${flashcardId}/attempt`, { rating });
    },
    onSuccess: async () => {
      setIsFlipped(false);
      
      // Incrementar contador de cartões completados
      setCompletedCount(prev => prev + 1);
      
      if (mode === "spaced") {
        // Modo Anki: invalidar query porque a lista "due" mudou
        await queryClient.invalidateQueries({ queryKey: ["/api/flashcards", summaryId, "due", i18n.language] });
        setCurrentIndex(0);
      } else {
        // Modo prática: avançar para o próximo flashcard
        setCurrentIndex(prev => prev + 1);
      }
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('flashcards.anki.errorRecording'),
        variant: "destructive",
      });
    },
  });

  const currentFlashcard = flashcards[currentIndex];
  const totalForSession = sessionTotal ?? flashcards.length;
  const completed = mode === "spaced" 
    ? flashcards.length === 0 && completedCount > 0
    : currentIndex >= flashcards.length;
  const progress = totalForSession > 0 ? ((completedCount / totalForSession) * 100) : 0;
  const nextAvailableAt = dueFlashcardsData?.nextAvailableAt;

  // Formatar tempo de sessão (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Atualizar countdown a cada minuto
  const [countdown, setCountdown] = useState<string | null>(null);
  useEffect(() => {
    const getTimeUntilNext = () => {
      if (!nextAvailableAt) return null;
      
      const now = new Date();
      const next = new Date(nextAvailableAt);
      const diffMs = next.getTime() - now.getTime();
      
      if (diffMs <= 0) return t('flashcards.anki.availableNow');
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    };

    if (mode === "spaced" && nextAvailableAt) {
      // Atualizar imediatamente
      setCountdown(getTimeUntilNext());
      
      // Atualizar a cada minuto
      const interval = setInterval(() => {
        setCountdown(getTimeUntilNext());
      }, 60000);
      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [mode, nextAvailableAt]);

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
        <p className="text-muted-foreground">{t('flashcards.anki.loading')}</p>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <Check className="w-16 h-16 mx-auto text-primary" />
        <div>
          <h3 className="text-xl font-semibold mb-2">{t('flashcards.anki.allReviewed')}</h3>
          <p className="text-muted-foreground">
            {t('flashcards.anki.noFlashcards')}
          </p>
          {mode === "spaced" && countdown && (
            <div className="mt-4">
              <Badge variant="outline" className="gap-1.5 text-base px-3 py-1.5">
                <Clock className="w-4 h-4" />
                {t('flashcards.anki.nextAvailable')}: {countdown}
              </Badge>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="text-center py-12 space-y-4">
        <Check className="w-16 h-16 mx-auto text-primary" />
        <div>
          <h3 className="text-xl font-semibold mb-2">{t('flashcards.anki.sessionComplete')}</h3>
          <p className="text-muted-foreground">
            {mode === "spaced" ? t('flashcards.anki.reviewed') : t('flashcards.anki.practiced')} {completedCount} flashcard{completedCount !== 1 ? 's' : ''}.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {t('flashcards.anki.time')}: {formatTime(sessionTime)}
          </p>
        </div>
        <Button
          onClick={() => {
            setCurrentIndex(0);
            setSessionTime(0);
            setSessionTotal(null);
            setCompletedCount(0);
            queryClient.invalidateQueries({ queryKey: ["/api/flashcards", summaryId, endpoint] });
          }}
          data-testid="button-restart-study"
        >
          {mode === "spaced" ? t('flashcards.anki.reviewAgain') : t('flashcards.anki.practiceAgain')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2" data-testid="flashcard-progress">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">{t('flashcards.anki.progress')}</span>
            <Badge variant="outline" className="gap-1.5">
              <Clock className="w-3 h-3" />
              {formatTime(sessionTime)}
            </Badge>
          </div>
          <span className="font-medium">
            {completedCount} / {totalForSession}
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
                <Badge variant="secondary">{t('flashcards.question')}</Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RotateCw className="w-4 h-4" />
                  <span>{t('flashcards.anki.clickToSeeAnswer')}</span>
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
                <Badge variant="default" className="mb-2">{t('flashcards.answer')}</Badge>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('flashcards.anki.howWasYourAnswer')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleRating(1)}
                    disabled={recordAttemptMutation.isPending}
                    variant="outline"
                    className="border-red-500/50 hover:bg-red-500/10"
                    data-testid="button-again"
                  >
                    <span className="text-red-600 dark:text-red-400">{t('flashcards.anki.again')}</span>
                  </Button>
                  <Button
                    onClick={() => handleRating(2)}
                    disabled={recordAttemptMutation.isPending}
                    variant="outline"
                    className="border-orange-500/50 hover:bg-orange-500/10"
                    data-testid="button-hard"
                  >
                    <span className="text-orange-600 dark:text-orange-400">{t('flashcards.anki.hard')}</span>
                  </Button>
                  <Button
                    onClick={() => handleRating(3)}
                    disabled={recordAttemptMutation.isPending}
                    variant="outline"
                    className="border-green-500/50 hover:bg-green-500/10"
                    data-testid="button-good"
                  >
                    <span className="text-green-600 dark:text-green-400">{t('flashcards.anki.good')}</span>
                  </Button>
                  <Button
                    onClick={() => handleRating(4)}
                    disabled={recordAttemptMutation.isPending}
                    variant="outline"
                    className="border-blue-500/50 hover:bg-blue-500/10"
                    data-testid="button-easy"
                  >
                    <span className="text-blue-600 dark:text-blue-400">{t('flashcards.anki.easy')}</span>
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
