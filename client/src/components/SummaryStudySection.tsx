import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import AnkiFlashcardDeck from "./AnkiFlashcardDeck";
import { Loader2, Brain, Calendar, Dumbbell, BookOpen, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient, authFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Flashcard type - stays in its creation language (no translations)
interface BundledFlashcard {
  id: string;
  topicId: string | null;
  subjectId: string | null;
  isManual: boolean;
  createdAt: string;
  language: string;
  question: string;
  answer: string;
  easeFactor?: number;
  interval?: number;
  repetitions?: number;
  nextReviewDate?: string | null;
  lastReviewDate?: string | null;
}

interface BundledFlashcardsResponse {
  success: boolean;
  flashcards: BundledFlashcard[];
}

interface SummaryStudySectionProps {
  topicId: string;
}

export default function SummaryStudySection({ topicId }: SummaryStudySectionProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { subscription, isLoading: subscriptionLoading } = useSubscription();
  const currentPlan = subscription?.plan || "free";
  const hasAdvancedFlashcards = currentPlan !== "free";
  const canGenerateMore = !subscriptionLoading && (currentPlan === "pro" || currentPlan === "premium");
  
  // Persist study mode per topic in localStorage to survive navigation
  const getStoredStudyMode = (): "spaced" | "practice" => {
    try {
      const stored = localStorage.getItem(`study_mode_${topicId}`);
      if (stored === "spaced" || stored === "practice") {
        // Ensure FREE users can't use spaced mode
        if (stored === "spaced" && !hasAdvancedFlashcards) return "practice";
        return stored;
      }
    } catch (e) {}
    return hasAdvancedFlashcards ? "spaced" : "practice";
  };
  
  const [studyMode, setStudyModeInternal] = useState<"spaced" | "practice">(getStoredStudyMode);
  
  // Wrapper to persist mode changes
  const setStudyMode = (mode: "spaced" | "practice") => {
    setStudyModeInternal(mode);
    try {
      localStorage.setItem(`study_mode_${topicId}`, mode);
    } catch (e) {}
  };

  // Fetch summaries for this topic (needed for regenerate) - still needs language for summary content
  const { data: summariesData } = useQuery<{ success: boolean; summaries: any[] }>({
    queryKey: ["/api/topics", topicId, "summaries", i18n.language],
    queryFn: async () => {
      const res = await authFetch(`/api/topics/${topicId}/summaries?language=${i18n.language}`);
      if (!res.ok) throw new Error("Failed to fetch summaries");
      return res.json();
    },
    staleTime: 60000,
  });

  // Track background generation state
  const [isGeneratingInBackground, setIsGeneratingInBackground] = useState(false);

  // Regenerate flashcards mutation with immediate feedback
  const regenerateMutation = useMutation({
    mutationFn: async (topicSummaryId: string) => {
      return apiRequest("POST", "/api/flashcards/regenerate", { topicSummaryId });
    },
    onMutate: () => {
      setIsGeneratingInBackground(true);
      toast({
        title: t('summaryStudy.generatingTitle'),
        description: t('summaryStudy.generatingDescription'),
      });
    },
    onSuccess: (data: any) => {
      setIsGeneratingInBackground(false);
      // Invalidate ALL flashcard queries to update counts everywhere
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/topic", topicId, "bundled"] });
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards"], exact: false });
      
      // Check if all content is already covered (no new unique flashcards could be generated)
      if (data.allContentCovered) {
        toast({
          title: t('summaryStudy.allContentCoveredTitle'),
          description: t('summaryStudy.allContentCoveredDescription'),
        });
      } else {
        toast({
          title: t('summaryStudy.regenerateSuccessTitle'),
          description: t('summaryStudy.regenerateSuccessDescription', { 
            previousCount: data.previousCount || 0, 
            newCount: data.newCount || 0 
          }),
        });
      }
    },
    onError: () => {
      setIsGeneratingInBackground(false);
      toast({
        title: t('summaryStudy.errorRegenerateTitle'),
        description: t('summaryStudy.errorRegenerate'),
        variant: "destructive",
      });
    },
  });

  const handleGenerateMore = async () => {
    const cachedSummaries = summariesData?.summaries;
    let summaryId = cachedSummaries ? Object.values(cachedSummaries)?.[0]?.id : undefined;
    
    if (!summaryId) {
      try {
        const res = await authFetch(`/api/topics/${topicId}/summaries?language=${i18n.language}`);
        if (res.ok) {
          const data = await res.json();
          const summariesObj = data.summaries;
          if (summariesObj && typeof summariesObj === 'object') {
            const firstSummary = Object.values(summariesObj)?.[0] as any;
            summaryId = firstSummary?.id;
          }
        }
      } catch (e) {
        console.error("Failed to fetch summaries for regeneration");
      }
    }
    
    if (summaryId) {
      regenerateMutation.mutate(summaryId);
    } else {
      toast({
        title: t('summaryStudy.errorRegenerateTitle'),
        description: t('summaryStudy.errorRegenerate'),
        variant: "destructive",
      });
    }
  };

  // Fetch ALL flashcards with ALL translations bundled - NO language in query key!
  const { data: bundledData, isLoading, error } = useQuery<BundledFlashcardsResponse>({
    queryKey: ["/api/flashcards/topic", topicId, "bundled"],
    queryFn: async () => {
      const res = await authFetch(`/api/flashcards/topic/${topicId}/bundled`);
      if (!res.ok) throw new Error("Failed to fetch flashcards");
      return res.json();
    },
    staleTime: 30000,
    gcTime: 60000,
    retry: 1,
  });
  
  // Debug: log any errors
  if (error) {
    console.error("[SummaryStudySection] Error fetching flashcards:", error);
  }

  // Transform flashcards to display format (no translations - use creation language)
  const displayFlashcards = useMemo(() => {
    if (!bundledData?.flashcards) return [];
    
    return bundledData.flashcards.map(fc => ({
      id: fc.id,
      question: fc.question,
      answer: fc.answer,
      topicId: fc.topicId,
      subjectId: fc.subjectId,
      isManual: fc.isManual,
      createdAt: fc.createdAt,
      language: fc.language || 'pt',
      easeFactor: fc.easeFactor,
      interval: fc.interval,
      repetitions: fc.repetitions,
      nextReviewDate: fc.nextReviewDate,
      lastReviewDate: fc.lastReviewDate,
    }));
  }, [bundledData]);

  const hasFlashcards = displayFlashcards.length > 0;

  if (isLoading) {
    return (
      <Card className="border-2">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('summaryStudy.loading')}</p>
        </CardContent>
      </Card>
    );
  }

  // Check if we have summaries to generate flashcards from
  const hasSummaries = summariesData?.summaries && 
    (Array.isArray(summariesData.summaries) 
      ? summariesData.summaries.length > 0 
      : Object.keys(summariesData.summaries).length > 0);

  if (!hasFlashcards) {
    // If there are summaries, show option to generate flashcards
    if (hasSummaries) {
      return (
        <Card className="border-2">
          <CardContent className="p-8 text-center">
            <Brain className="w-8 h-8 mx-auto mb-4 text-primary" />
            <p className="text-sm text-muted-foreground mb-4">{t('summaryStudy.noFlashcardsYet')}</p>
            <Button
              onClick={handleGenerateMore}
              disabled={regenerateMutation.isPending || isGeneratingInBackground}
              data-testid="button-generate-flashcards-initial"
              className="gap-2"
            >
              {(regenerateMutation.isPending || isGeneratingInBackground) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {t('summaryStudy.generateFlashcardsButton')}
            </Button>
          </CardContent>
        </Card>
      );
    }
    
    // No summaries and no flashcards
    return (
      <Card className="border-2 border-muted">
        <CardContent className="p-8 text-center">
          <BookOpen className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('summaryStudy.noFlashcards')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2">
      <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex-shrink-0">
              <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-xl">{t('summaryStudy.title')}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {t('summaryStudy.available', { count: displayFlashcards.length })}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 sm:gap-2">
            {canGenerateMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateMore}
                disabled={regenerateMutation.isPending}
                data-testid="button-generate-more"
                className="gap-1 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
              >
                {regenerateMutation.isPending ? (
                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                )}
                <span className="hidden sm:inline">{t('summaryStudy.regenerateButton')}</span>
              </Button>
            )}
            {hasAdvancedFlashcards && (
              <Button
                variant={studyMode === "spaced" ? "default" : "outline"}
                size="sm"
                onClick={() => setStudyMode("spaced")}
                data-testid="button-mode-spaced"
                className="gap-1 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
              >
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{t('summaryStudy.modeAnki')}</span>
              </Button>
            )}
            <Button
              variant={hasAdvancedFlashcards ? (studyMode === "practice" ? "default" : "outline") : "default"}
              size="sm"
              onClick={() => setStudyMode("practice")}
              data-testid="button-mode-practice"
              className="gap-1 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
            >
              <Dumbbell className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t('summaryStudy.modePractice')}</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
        {/* key forces remount when mode changes, ensuring separate state for each mode */}
        <AnkiFlashcardDeck key={`${topicId}-${studyMode}`} topicId={topicId} mode={studyMode} />
      </CardContent>
    </Card>
  );
}
