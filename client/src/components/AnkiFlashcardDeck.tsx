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
  topicId: string;
  mode?: "spaced" | "practice";
}

export default function AnkiFlashcardDeck({ topicId, mode = "spaced" }: AnkiFlashcardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [localDeck, setLocalDeck] = useState<ApiFlashcard[]>([]);
  const [deckInitialized, setDeckInitialized] = useState(false);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const endpoint = mode === "practice" ? "all" : "due";
  
  const { data: dueFlashcardsData, isLoading } = useQuery<{ 
    success: boolean; 
    flashcards: ApiFlashcard[];
    nextAvailableAt?: string | null;
  }>({
    queryKey: ["/api/flashcards/topic", topicId, endpoint, i18n.language],
    queryFn: async () => {
      const res = await fetch(`/api/flashcards/topic/${topicId}/${endpoint}?language=${i18n.language}`);
      if (!res.ok) throw new Error("Erro ao carregar flashcards");
      return res.json();
    },
  });

  const { data: allFlashcardsData } = useQuery<{ 
    success: boolean; 
    flashcards: ApiFlashcard[];
  }>({
    queryKey: ["/api/flashcards/topic", topicId, "all", i18n.language],
    queryFn: async () => {
      const res = await fetch(`/api/flashcards/topic/${topicId}/all?language=${i18n.language}`);
      if (!res.ok) throw new Error("Erro ao carregar flashcards");
      return res.json();
    },
  });

  // Initialize local deck from server data
  useEffect(() => {
    if (dueFlashcardsData?.flashcards && !deckInitialized) {
      setLocalDeck(dueFlashcardsData.flashcards);
      setDeckInitialized(true);
    }
  }, [dueFlashcardsData, deckInitialized]);

  // Reset when mode changes
  useEffect(() => {
    setCurrentIndex(0);
    setSessionTime(0);
    setIsFlipped(false);
    setCompletedCount(0);
    setLocalDeck([]);
    setDeckInitialized(false);
  }, [mode, topicId]);

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalFlashcards = allFlashcardsData?.flashcards?.length || 0;
  const nextAvailableAt = dueFlashcardsData?.nextAvailableAt;

  const recordAttemptMutation = useMutation({
    mutationFn: async ({ flashcardId, rating }: { flashcardId: string; rating: number }) => {
      return apiRequest("POST", `/api/flashcards/${flashcardId}/attempt`, { rating });
    },
    onSuccess: (_, variables) => {
      setCompletedCount(prev => prev + 1);
      setIsFlipped(false);
      
      if (mode === "spaced") {
        // Remove the rated card from local deck immediately
        setLocalDeck(prev => prev.filter(card => card.id !== variables.flashcardId));
        // Invalidate cache for background sync
        queryClient.invalidateQueries({ queryKey: ["/api/flashcards/topic", topicId, "due", i18n.language] });
      } else {
        // Practice mode: just move to next card
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

  const currentFlashcard = localDeck[currentIndex];
  const completed = mode === "spaced" 
    ? localDeck.length === 0 && completedCount > 0
    : currentIndex >= localDeck.length && localDeck.length > 0;
  const progress = totalFlashcards > 0 ? ((completedCount / totalFlashcards) * 100) : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
      setCountdown(getTimeUntilNext());
      const interval = setInterval(() => {
        setCountdown(getTimeUntilNext());
      }, 60000);
      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [mode, nextAvailableAt, t]);

  const handleRating = (rating: number) => {
    if (!currentFlashcard || recordAttemptMutation.isPending) return;
    recordAttemptMutation.mutate({
      flashcardId: currentFlashcard.id,
      rating,
    });
  };

  const handleFlip = () => {
    if (!isFlipped) {
      setIsFlipped(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSessionTime(0);
    setCompletedCount(0);
    setDeckInitialized(false);
    setLocalDeck([]);
    queryClient.invalidateQueries({ queryKey: ["/api/flashcards/topic", topicId, endpoint, i18n.language] });
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{t('flashcards.anki.loading')}</p>
      </div>
    );
  }

  if (localDeck.length === 0 && deckInitialized && completedCount === 0) {
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
        <Button onClick={handleRestart} data-testid="button-restart-study">
          {mode === "spaced" ? t('flashcards.anki.reviewAgain') : t('flashcards.anki.practiceAgain')}
        </Button>
      </div>
    );
  }

  if (!currentFlashcard) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{t('flashcards.anki.loading')}</p>
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
            {completedCount} / {totalFlashcards}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card 
        className="min-h-96 border-2"
        data-testid={`flashcard-${currentFlashcard.id}`}
      >
        <CardContent className="flex flex-col h-full min-h-96 justify-between p-8">
          {!isFlipped ? (
            <>
              <div className="flex-1 flex items-center justify-center cursor-pointer" onClick={handleFlip}>
                <p
                  className="text-2xl font-medium text-center"
                  data-testid={`question-${currentFlashcard.id}`}
                >
                  {currentFlashcard.question}
                </p>
              </div>
              <div className="flex items-center justify-between pt-6 border-t">
                <Badge variant="secondary">{t('flashcards.question')}</Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleFlip}
                  className="gap-2"
                  data-testid="button-flip"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>{t('flashcards.anki.clickToSeeAnswer')}</span>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 flex items-center justify-center">
                <p
                  className="text-xl text-center"
                  data-testid={`answer-${currentFlashcard.id}`}
                >
                  {currentFlashcard.answer}
                </p>
              </div>
              <div className="space-y-4 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <Badge variant="default">{t('flashcards.answer')}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('flashcards.anki.howWasYourAnswer')}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    onClick={() => handleRating(1)}
                    disabled={recordAttemptMutation.isPending}
                    variant="outline"
                    className="border-red-500/50 text-red-600 dark:text-red-400"
                    data-testid="button-again"
                  >
                    {t('flashcards.anki.again')}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleRating(2)}
                    disabled={recordAttemptMutation.isPending}
                    variant="outline"
                    className="border-orange-500/50 text-orange-600 dark:text-orange-400"
                    data-testid="button-hard"
                  >
                    {t('flashcards.anki.hard')}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleRating(3)}
                    disabled={recordAttemptMutation.isPending}
                    variant="outline"
                    className="border-green-500/50 text-green-600 dark:text-green-400"
                    data-testid="button-good"
                  >
                    {t('flashcards.anki.good')}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleRating(4)}
                    disabled={recordAttemptMutation.isPending}
                    variant="outline"
                    className="border-blue-500/50 text-blue-600 dark:text-blue-400"
                    data-testid="button-easy"
                  >
                    {t('flashcards.anki.easy')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
