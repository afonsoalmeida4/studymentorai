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
  const isDev = Boolean((import.meta as any)?.env?.DEV);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [localDeck, setLocalDeck] = useState<DisplayFlashcard[]>([]);
  const [deckInitialized, setDeckInitialized] = useState(false);
  const [progressRestored, setProgressRestored] = useState(false);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  // Track which cards have been completed in this session (by id)
  const [completedCardIds, setCompletedCardIds] = useState<Set<string>>(new Set());

  // State for studying early (bypass nextReviewDate filter)
  const [studyEarly, setStudyEarly] = useState(false);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [forcedNextReviewAt, setForcedNextReviewAt] = useState<string | null>(null);




  // 🔑 Guarda a próxima revisão quando só existe 1 flashcard
  const [lastNextReviewDate, setLastNextReviewDate] = useState<string | null>(null);

  
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
    if (mode !== "spaced") return null;

    if (forcedNextReviewAt) {
      return forcedNextReviewAt;
    }

    if (!bundledData?.flashcards) return null;

    const now = new Date();

    const futureCards = bundledData.flashcards
      .filter(fc => fc.nextReviewDate && new Date(fc.nextReviewDate) > now);

    if (futureCards.length === 0) return null;

    return new Date(
      Math.min(...futureCards.map(fc => new Date(fc.nextReviewDate!).getTime()))
    ).toISOString();
  }, [mode, forcedNextReviewAt, bundledData]);


  
  // Override filtered flashcards when studying early
  const effectiveFlashcards = useMemo((): DisplayFlashcard[] => {
    if (studyEarly && mode === "spaced") {
      return allDisplayFlashcards; // Show all flashcards when studying early
    }
    return filteredFlashcards;
  }, [studyEarly, mode, allDisplayFlashcards, filteredFlashcards]);

  // 🔑 Fonte de verdade: backend diz se há cartões por rever
  const noFlashcardsDue = useMemo(() => {
    return (
      mode === "spaced" &&
      !studyEarly &&
      filteredFlashcards.length === 0
    );
  }, [mode, studyEarly, filteredFlashcards]);

  const sessionEffectivelyFinished = useMemo(() => {
    if (mode !== "spaced") return false;

    // ainda existem cartões por rever
    if (filteredFlashcards.length > 0) return false;

    // só consideramos sessão terminada se já respondeu a pelo menos 1
    return completedCount > 0;
  }, [mode, filteredFlashcards.length, completedCount]);



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
      const remainingCards = effectiveFlashcards.filter(fc => !completedCardIds.has(fc.id));
      setLocalDeck(remainingCards);

      // Ensure currentIndex is within bounds of the new deck to avoid rendering a null card
      setCurrentIndex(prev => {
        if (remainingCards.length === 0) return 0;
        if (prev < remainingCards.length) return prev;
        // If previous index is out of bounds, reset to 0 (start of deck)
        return 0;
      });

      setDeckInitialized(true);
    }
  }, [effectiveFlashcards, completedCardIds, progressRestored, isLoading]);

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
    onSuccess: async (_, variables) => {
      setDeckInitialized(true);
      const newCompletedCount = completedCount + 1;
      setCompletedCount(newCompletedCount);
      setIsFlipped(false);
      

      if (mode === "spaced") {
        const newCompletedIds = [...Array.from(completedCardIds), variables.flashcardId];
        setCompletedCardIds(new Set(newCompletedIds));
        const remainingAfter = effectiveFlashcards.filter(
          fc => !newCompletedIds.includes(fc.id)
        );


        saveProgress({
          completedCount: newCompletedCount,
          completedCardIds: newCompletedIds,
        });

        // 🔥 BUSCAR O nextReviewDate ATUALIZADO (do cartão atualizado ou do mínimo de todos)
        try {
          const res = await authFetch(`/api/flashcards/topic/${topicId}/bundled`);
          if (res.ok) {
            const data = await res.json();

            const updated = data.flashcards.find((fc: any) => fc.id === variables.flashcardId);

            // compute earliest future nextReviewDate among all flashcards
            const now = new Date();
            const futureDates = data.flashcards
              .map((fc: any) => fc.nextReviewDate)
              .filter((d: any) => d)
              .map((d: string) => new Date(d))
              .filter((dt: Date) => dt > now);

            const earliest = futureDates.length
              ? new Date(Math.min(...futureDates.map((d: Date) => d.getTime()))).toISOString()
              : null;

            if (updated?.nextReviewDate) {
              setForcedNextReviewAt(updated.nextReviewDate);
              if (isDev) console.debug("set forcedNextReviewAt (updated):", updated.nextReviewDate);
            } else if (earliest) {
              setForcedNextReviewAt(earliest);
              if (isDev) console.debug("set forcedNextReviewAt (earliest):", earliest);
            } else {
              setForcedNextReviewAt(null);
              if (isDev) console.debug("no nextReviewDate available after attempt");
            }
          }
        } catch (err) {
          // ignore fetch errors here; query invalidation below will refresh data
        }

        if (remainingAfter.length === 0) {
          setSessionFinished(true);
        }

        queryClient.invalidateQueries({ queryKey: ["/api/flashcards/topic", topicId, "bundled"] });
      } else {
        const newIndex = currentIndex + 1;
        setCurrentIndex(newIndex);

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

  
  const totalFlashcards = allDisplayFlashcards.length;
  const progress = totalFlashcards > 0 ? ((completedCount / totalFlashcards) * 100) : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (!nextAvailableAt || mode !== "spaced") {
      setCountdown(null);
      return;
    }

    const update = () => {
      const diff = new Date(nextAvailableAt).getTime() - Date.now();

      if (diff <= 0) {
        setCountdown(t("flashcards.anki.availableNow"));
        return;
      }

      const total = Math.floor(diff / 1000);
      const days = Math.floor(total / 86400);
      const hours = Math.floor((total % 86400) / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const seconds = total % 60;

      setCountdown(
        days > 0
          ? `${days}d ${hours}h ${minutes}m ${seconds}s`
          : hours > 0
          ? `${hours}h ${minutes}m ${seconds}s`
          : `${minutes}m ${seconds}s`
      );
    };

    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, [nextAvailableAt, mode, t]);

  // If session finished but we don't have a forced next review date yet,
  // try to fetch bundled data and compute earliest nextReviewDate so the countdown can show.
  useEffect(() => {
    if (mode !== "spaced") return;
    if (!sessionFinished) return;
    if (forcedNextReviewAt) return;

    let mounted = true;
    (async () => {
      try {
        const res = await authFetch(`/api/flashcards/topic/${topicId}/bundled`);
        if (!mounted) return;
        if (!res.ok) return;
        const data = await res.json();
        const now = new Date();
        const futureDates = data.flashcards
          .map((fc: any) => fc.nextReviewDate)
          .filter((d: any) => d)
          .map((d: string) => new Date(d))
          .filter((dt: Date) => dt > now);

        if (futureDates.length > 0) {
          const earliest = new Date(Math.min(...futureDates.map((d: Date) => d.getTime()))).toISOString();
          setForcedNextReviewAt(earliest);
          if (isDev) console.debug("fetched earliest nextReviewDate on sessionFinished:", earliest);
        } else {
          if (isDev) console.debug("no future dates found on sessionFinished fetch");
        }
      } catch (err) {
        // ignore
      }
    })();

    return () => { mounted = false; };
  }, [sessionFinished, forcedNextReviewAt, mode, topicId]);




  
  // Handle study early - force reload flashcards ignoring nextReviewDate
  const handleStudyEarly = () => {
    setStudyEarly(true);
    setSessionFinished(false);
    setDeckInitialized(false);
    setProgressRestored(false);

    setLocalDeck([]);
    setCompletedCardIds(new Set());
    setCurrentIndex(0);
    setCompletedCount(0);
    resetProgress();
    setSessionFinished(false);

  };


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

  // ⛑️ PROTEÇÃO: o deck ainda não está pronto
  if (!deckInitialized || !progressRestored) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {t('flashcards.anki.loading')}
        </p>
      </div>
    );
  }

   const currentFlashcard =
    localDeck.length > 0 && currentIndex < localDeck.length
      ? localDeck[currentIndex]
      : null;


  // 2️⃣ Sessão terminada — estado FINAL
  if (
    sessionFinished &&
    deckInitialized
  ) {
    return (
      <div className="text-center py-12 space-y-6">
        <Check className="w-16 h-16 mx-auto text-primary" />

        <div>
          <h3 className="text-xl font-semibold mb-2">
            {t('flashcards.anki.sessionComplete')}
          </h3>

          <p className="text-muted-foreground">
            {t('flashcards.anki.reviewed')} {completedCount} flashcard
            {completedCount === 1 ? '' : 's'}.
          </p>
        </div>

        {nextAvailableAt && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('flashcards.anki.nextReviewIn')}
            </p>

            <div className="text-2xl font-mono font-bold text-primary">
              {countdown}
            </div>
          </div>
        )}

        <Button
          variant="outline"
          onClick={handleStudyEarly}
          className="gap-2"
        >
          <RotateCw className="w-4 h-4" />
          {t('flashcards.anki.studyEarly')}
        </Button>
      </div>
    );
  }


  // 🟡 Não há flashcards para estudar agora (mas sessão NÃO terminou)
  if (noFlashcardsDue && !sessionFinished) {
    return (
      <div className="text-center py-12 space-y-6">
        <Check className="w-16 h-16 mx-auto text-primary" />

        <div>
          <h3 className="text-xl font-semibold mb-2">
            {t('flashcards.anki.allReviewed')}
          </h3>

          <p className="text-muted-foreground">
            {t('flashcards.anki.noFlashcards')}
          </p>
        </div>

        {nextAvailableAt && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('flashcards.anki.nextReviewIn')}
            </p>

            <div className="text-2xl font-mono font-bold text-primary">
              {countdown}
            </div>
          </div>
        )}

        <Button
          variant="outline"
          onClick={handleStudyEarly}
          className="gap-2"
        >
          <RotateCw className="w-4 h-4" />
          {t('flashcards.anki.studyEarly')}
        </Button>
      </div>
    );
  }

  if (!currentFlashcard) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">
          {t('flashcards.anki.noFlashcards')}
        </p>

        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" onClick={handleRestart}>
            {t('flashcards.anki.restart')}
          </Button>
          <Button variant="ghost" onClick={() => { setStudyEarly(true); setDeckInitialized(false); setProgressRestored(true); }}>
            {t('flashcards.anki.studyEarly')}
          </Button>
        </div>
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
