import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RotateCw, Check, Clock } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, authFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useFlashcardProgress } from "@/hooks/useFlashcardProgress";

// Flashcard type - stays in its creation language (no translations)
interface BundledFlashcard {
  id: string;
  topicId: string | null;
  subjectId: string | null;
  isManual: boolean;
  createdAt: string;
  language: string; // Language in which flashcard was created
  question: string;
  answer: string;
  easeFactor?: number;
  interval?: number;
  repetitions?: number;
  nextReviewDate?: string | null;
  lastReviewDate?: string | null;
}

// Display flashcard with language badge
interface DisplayFlashcard {
  id: string;
  question: string;
  answer: string;
  language: string;
  nextReviewDate?: string | null;
  lastReviewDate?: string | null;
}

interface BundledFlashcardsResponse {
  success: boolean;
  flashcards: BundledFlashcard[];
}

interface AnkiFlashcardDeckProps {
  topicId: string;
  mode?: "spaced" | "practice";
}

export default function AnkiFlashcardDeck({ topicId, mode = "spaced" }: AnkiFlashcardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [localDeck, setLocalDeck] = useState<DisplayFlashcard[]>([]);
  const [deckInitialized, setDeckInitialized] = useState(false);
  const [progressRestored, setProgressRestored] = useState(false);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  
  // Persistent progress storage
  const { progress: savedProgress, saveProgress, resetProgress, isLoaded: progressLoaded } = useFlashcardProgress(topicId, mode);

  // Fetch ALL flashcards with ALL translations bundled - NO language in query key!
  const { data: bundledData, isLoading } = useQuery<BundledFlashcardsResponse>({
    queryKey: ["/api/flashcards/topic", topicId, "bundled"],
    queryFn: async () => {
      const res = await authFetch(`/api/flashcards/topic/${topicId}/bundled`);
      if (!res.ok) throw new Error("Erro ao carregar flashcards");
      return res.json();
    },
    staleTime: 30000,
    gcTime: 60000,
    retry: 1,
  });

  // Transform flashcards to display format (flashcards stay in creation language)
  const allDisplayFlashcards = useMemo((): DisplayFlashcard[] => {
    if (!bundledData?.flashcards) return [];
    
    return bundledData.flashcards.map(fc => ({
      id: fc.id,
      question: fc.question,
      answer: fc.answer,
      language: fc.language || 'pt',
      nextReviewDate: fc.nextReviewDate,
      lastReviewDate: fc.lastReviewDate,
    }));
  }, [bundledData]);

  // Filter for due flashcards (spaced mode) or all (practice mode)
  const filteredFlashcards = useMemo((): DisplayFlashcard[] => {
    if (mode === "practice") {
      return allDisplayFlashcards;
    }
    
    // Spaced mode: filter for due flashcards
    const now = new Date();
    return allDisplayFlashcards.filter(fc => {
      if (!fc.nextReviewDate) return true; // Never reviewed = due now
      return new Date(fc.nextReviewDate) <= now;
    });
  }, [allDisplayFlashcards, mode]);

  // Calculate next available time for spaced mode
  const nextAvailableAt = useMemo((): string | null => {
    if (mode !== "spaced" || !bundledData?.flashcards) return null;
    
    const now = new Date();
    const futureCards = bundledData.flashcards
      .filter(fc => fc.nextReviewDate && new Date(fc.nextReviewDate) > now)
      .map(fc => new Date(fc.nextReviewDate!));
    
    if (futureCards.length === 0) return null;
    
    const earliest = new Date(Math.min(...futureCards.map(d => d.getTime())));
    return earliest.toISOString();
  }, [bundledData, mode]);

  // Track which cards have been completed in this session (by id)
  const [completedCardIds, setCompletedCardIds] = useState<Set<string>>(new Set());

  // Restore progress from localStorage when loaded
  useEffect(() => {
    if (progressLoaded && !progressRestored) {
      setCurrentIndex(savedProgress.currentIndex);
      setCompletedCount(savedProgress.completedCount);
      setSessionTime(savedProgress.sessionTime);
      setCompletedCardIds(new Set(savedProgress.completedCardIds));
      setProgressRestored(true);
    }
  }, [progressLoaded, progressRestored, savedProgress]);

  // Reset progressRestored flag when mode/topic changes
  useEffect(() => {
    setProgressRestored(false);
    setDeckInitialized(false);
    setIsFlipped(false);
  }, [mode, topicId]);

  // Initialize local deck from filtered data, excluding completed cards
  useEffect(() => {
    // Initialize deck once progress is restored, even if no flashcards are available
    if (progressRestored && !isLoading) {
      // Filter out already completed cards
      const remainingCards = filteredFlashcards.filter(fc => !completedCardIds.has(fc.id));
      
      // Find current card's id and locate it in the new deck
      const currentCardId = localDeck[currentIndex]?.id;
      
      setLocalDeck(remainingCards);
      
      // If we had a current card, try to find it in the new deck
      if (currentCardId && deckInitialized) {
        const newIndex = remainingCards.findIndex(fc => fc.id === currentCardId);
        if (newIndex !== -1 && newIndex !== currentIndex) {
          setCurrentIndex(newIndex);
        }
      }
      
      setDeckInitialized(true);
    }
  }, [filteredFlashcards, completedCardIds, progressRestored, isLoading]);

  // Session timer with persistence
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime(prev => {
        const newTime = prev + 1;
        // Save time every 5 seconds to avoid too many writes
        if (newTime % 5 === 0) {
          saveProgress({ sessionTime: newTime });
        }
        return newTime;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [saveProgress]);

  const recordAttemptMutation = useMutation({
    mutationFn: async ({ flashcardId, rating }: { flashcardId: string; rating: number }) => {
      return apiRequest("POST", `/api/flashcards/${flashcardId}/attempt`, { rating });
    },
    onSuccess: (_, variables) => {
      const newCompletedCount = completedCount + 1;
      setCompletedCount(newCompletedCount);
      setIsFlipped(false);
      
      if (mode === "spaced") {
        // Track completed card by flashcardId
        const newCompletedIds = [...Array.from(completedCardIds), variables.flashcardId];
        setCompletedCardIds(new Set(newCompletedIds));
        // Persist progress
        saveProgress({
          completedCount: newCompletedCount,
          completedCardIds: newCompletedIds,
        });
        // Invalidate ALL flashcard queries to update counts everywhere
        queryClient.invalidateQueries({ queryKey: ["/api/flashcards/topic", topicId, "bundled"] });
        queryClient.invalidateQueries({ queryKey: ["/api/flashcards"], exact: false });
      } else {
        // Practice mode: just move to next card
        const newIndex = currentIndex + 1;
        setCurrentIndex(newIndex);
        // Persist progress
        saveProgress({
          currentIndex: newIndex,
          completedCount: newCompletedCount,
        });
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
  const totalFlashcards = allDisplayFlashcards.length;
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
    setCompletedCardIds(new Set());
    // Reset persisted progress
    resetProgress();
    // Invalidate ALL flashcard queries to update counts everywhere
    queryClient.invalidateQueries({ queryKey: ["/api/flashcards/topic", topicId, "bundled"] });
    queryClient.invalidateQueries({ queryKey: ["/api/flashcards"], exact: false });
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
          {/* Show next available time in spaced mode */}
          {mode === "spaced" && nextAvailableAt && (
            <div className="mt-4">
              <Badge variant="outline" className="gap-1.5 text-base px-3 py-1.5">
                <Clock className="w-4 h-4" />
                {t('flashcards.anki.nextAvailable')}: {countdown || t('flashcards.anki.tomorrow')}
              </Badge>
            </div>
          )}
        </div>
        {/* Only show "Practice again" in practice mode - spaced mode has no replay option */}
        {mode === "practice" && (
          <Button onClick={handleRestart} data-testid="button-restart-study">
            {t('flashcards.anki.practiceAgain')}
          </Button>
        )}
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
      {mode === "practice" ? (
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
      ) : (
        <div className="flex items-center justify-end" data-testid="flashcard-progress">
          <Badge variant="outline" className="gap-1.5">
            <Clock className="w-3 h-3" />
            {formatTime(sessionTime)}
          </Badge>
        </div>
      )}

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
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{t('flashcards.question')}</Badge>
                  <Badge variant="outline" className="text-xs uppercase">
                    {currentFlashcard.language}
                  </Badge>
                </div>
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
                <div className="flex items-center gap-2">
                  <Badge variant="default">{t('flashcards.answer')}</Badge>
                  <Badge variant="outline" className="text-xs uppercase">
                    {currentFlashcard.language}
                  </Badge>
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
