import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RotateCw, Check, Clock } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

// Bundled flashcard type - contains all translations
interface BundledFlashcard {
  id: string;
  topicId: string | null;
  subjectId: string | null;
  isManual: boolean;
  createdAt: string;
  translations: Record<string, { question: string; answer: string; flashcardId: string }>;
  easeFactor?: number;
  interval?: number;
  repetitions?: number;
  nextReviewDate?: string | null;
  lastReviewDate?: string | null;
}

// Display flashcard - transformed from bundled based on current language
interface DisplayFlashcard {
  id: string;
  baseId: string;
  question: string;
  answer: string;
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
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  // Fetch ALL flashcards with ALL translations bundled - NO language in query key!
  const { data: bundledData, isLoading } = useQuery<BundledFlashcardsResponse>({
    queryKey: ["/api/flashcards/topic", topicId, "bundled"],
    queryFn: async () => {
      const res = await fetch(`/api/flashcards/topic/${topicId}/bundled`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao carregar flashcards");
      return res.json();
    },
    staleTime: 30000,
    gcTime: 60000,
    retry: 1,
  });

  // Transform bundled flashcards to display format based on current language
  const allDisplayFlashcards = useMemo((): DisplayFlashcard[] => {
    if (!bundledData?.flashcards) return [];
    
    const lang = i18n.language as string;
    
    return bundledData.flashcards.map(fc => {
      const translation = fc.translations[lang] || fc.translations['pt'];
      
      return {
        id: translation?.flashcardId || fc.id,
        baseId: fc.id,
        question: translation?.question || '',
        answer: translation?.answer || '',
        nextReviewDate: fc.nextReviewDate,
        lastReviewDate: fc.lastReviewDate,
      };
    });
  }, [bundledData, i18n.language]);

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

  // Track which cards have been completed in this session (by baseId)
  const [completedCardIds, setCompletedCardIds] = useState<Set<string>>(new Set());

  // Initialize local deck from filtered data, excluding completed cards
  // Re-sync translations when language changes
  useEffect(() => {
    if (filteredFlashcards.length > 0) {
      // Filter out already completed cards and update translations
      const remainingCards = filteredFlashcards.filter(fc => !completedCardIds.has(fc.baseId));
      setLocalDeck(remainingCards);
      setDeckInitialized(true);
    }
  }, [filteredFlashcards, completedCardIds]);

  // Reset when mode or topic changes
  useEffect(() => {
    setCurrentIndex(0);
    setSessionTime(0);
    setIsFlipped(false);
    setCompletedCount(0);
    setLocalDeck([]);
    setDeckInitialized(false);
    setCompletedCardIds(new Set());
  }, [mode, topicId]);

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalFlashcards = allDisplayFlashcards.length;

  const recordAttemptMutation = useMutation({
    mutationFn: async ({ flashcardId, baseId, rating }: { flashcardId: string; baseId: string; rating: number }) => {
      return apiRequest("POST", `/api/flashcards/${flashcardId}/attempt`, { rating });
    },
    onSuccess: (_, variables) => {
      setCompletedCount(prev => prev + 1);
      setIsFlipped(false);
      
      if (mode === "spaced") {
        // Track completed card by baseId (persists across language changes)
        setCompletedCardIds(prev => {
          const newSet = new Set(Array.from(prev));
          newSet.add(variables.baseId);
          return newSet;
        });
        // Invalidate bundled cache for background sync
        queryClient.invalidateQueries({ queryKey: ["/api/flashcards/topic", topicId, "bundled"] });
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
      baseId: currentFlashcard.baseId,
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
    queryClient.invalidateQueries({ queryKey: ["/api/flashcards/topic", topicId, "bundled"] });
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
