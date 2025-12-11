import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import type { GenerateFlashcardsResponse } from "@shared/schema";
import AnkiFlashcardDeck from "./AnkiFlashcardDeck";
import { Loader2, Brain, Calendar, Dumbbell, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SummaryStudySectionProps {
  topicId: string;
}

export default function SummaryStudySection({ topicId }: SummaryStudySectionProps) {
  const { t, i18n } = useTranslation();
  const { subscription } = useSubscription();
  const currentPlan = subscription?.plan || "free";
  const hasAdvancedFlashcards = currentPlan !== "free";
  const [studyMode, setStudyMode] = useState<"spaced" | "practice">(hasAdvancedFlashcards ? "spaced" : "practice");

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
