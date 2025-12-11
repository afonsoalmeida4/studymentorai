import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import type { GenerateFlashcardsResponse } from "@shared/schema";
import AnkiFlashcardDeck from "./AnkiFlashcardDeck";
import { Loader2, Brain, Calendar, Dumbbell, BookOpen, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const [studyMode, setStudyMode] = useState<"spaced" | "practice">(hasAdvancedFlashcards ? "spaced" : "practice");

  // Fetch summaries for this topic (needed for regenerate)
  const { data: summariesData } = useQuery<{ success: boolean; summaries: any[] }>({
    queryKey: ["/api/topics", topicId, "summaries", i18n.language],
    queryFn: async () => {
      const res = await fetch(`/api/topics/${topicId}/summaries?language=${i18n.language}`);
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
      // Show immediate feedback - don't wait for response
      setIsGeneratingInBackground(true);
      toast({
        title: t('summaryStudy.generatingTitle'),
        description: t('summaryStudy.generatingDescription'),
      });
    },
    onSuccess: (data: any) => {
      setIsGeneratingInBackground(false);
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/topic", topicId, "all", i18n.language] });
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/topic", topicId, "due", i18n.language] });
      toast({
        title: t('summaryStudy.regenerateSuccessTitle'),
        description: t('summaryStudy.regenerateSuccessDescription', { 
          previousCount: data.previousCount || 0, 
          newCount: data.newCount || 0 
        }),
      });
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
    // Use cached summaries if available, otherwise fetch
    // Note: summaries is an object keyed by learning style, not an array
    const cachedSummaries = summariesData?.summaries;
    let summaryId = cachedSummaries ? Object.values(cachedSummaries)?.[0]?.id : undefined;
    
    if (!summaryId) {
      // Fetch summaries directly if not cached
      try {
        const res = await fetch(`/api/topics/${topicId}/summaries?language=${i18n.language}`);
        if (res.ok) {
          const data = await res.json();
          // summaries is an object keyed by learning style
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

  // Fetch ALL flashcards from ALL summaries in this topic
  const { data: flashcardsData, isLoading } = useQuery<GenerateFlashcardsResponse>({
    queryKey: ["/api/flashcards/topic", topicId, "all", i18n.language],
    queryFn: async () => {
      const res = await fetch(`/api/flashcards/topic/${topicId}/all?language=${i18n.language}`);
      if (!res.ok) throw new Error("Failed to fetch flashcards");
      return res.json();
    },
    staleTime: 30000,
  });

  const hasFlashcards = flashcardsData?.flashcards && flashcardsData.flashcards.length > 0;

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

  if (!hasFlashcards) {
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
                {t('summaryStudy.available', { count: flashcardsData.flashcards?.length || 0 })}
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
      <CardContent className="px-3 sm:px-6">
        <AnkiFlashcardDeck topicId={topicId} mode={studyMode} />
      </CardContent>
    </Card>
  );
}
