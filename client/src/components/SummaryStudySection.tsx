import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSubscription } from "@/hooks/useSubscription";
import type { GenerateFlashcardsResponse } from "@shared/schema";
import AnkiFlashcardDeck from "./AnkiFlashcardDeck";
import { Loader2, Brain, Sparkles, Calendar, Dumbbell } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SummaryStudySectionProps {
  summaryId: string;
}

export default function SummaryStudySection({ summaryId }: SummaryStudySectionProps) {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { subscription } = useSubscription();
  const currentPlan = subscription?.plan || "free";
  const hasAdvancedFlashcards = currentPlan !== "free";
  const [studyMode, setStudyMode] = useState<"spaced" | "practice">(hasAdvancedFlashcards ? "spaced" : "practice");

  // Fetch existing flashcards
  const { data: flashcardsData, isLoading } = useQuery<GenerateFlashcardsResponse>({
    queryKey: ["/api/flashcards", summaryId, "all", i18n.language],
    queryFn: async () => {
      const res = await fetch(`/api/flashcards/${summaryId}/all?language=${i18n.language}`);
      if (!res.ok) throw new Error("Failed to fetch flashcards");
      return res.json();
    },
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
        queryClient.setQueryData<GenerateFlashcardsResponse>(["/api/flashcards", summaryId, "all", i18n.language], data);
        
        toast({
          title: t('summaryStudy.successTitle'),
          description: t('summaryStudy.successDescription', { count: data.flashcards.length }),
        });
      } else {
        toast({
          variant: "destructive",
          title: t('common.error'),
          description: data.error || t('summaryStudy.errorGenerate'),
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: t('summaryStudy.errorGenerateTitle'),
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
          <p className="text-sm text-muted-foreground">{t('summaryStudy.loading')}</p>
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
                <CardTitle className="text-xl">{t('summaryStudy.title')}</CardTitle>
                <CardDescription>
                  {t('summaryStudy.description')}
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
                  {t('summaryStudy.generating')}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  {t('summaryStudy.generateButton')}
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
                  <CardTitle className="text-xl">{t('summaryStudy.title')}</CardTitle>
                  <CardDescription>
                    {t('summaryStudy.available', { count: flashcardsData.flashcards?.length || 0 })}
                  </CardDescription>
                </div>
              </div>
              {hasAdvancedFlashcards ? (
                <div className="flex gap-2">
                  <Button
                    variant={studyMode === "spaced" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStudyMode("spaced")}
                    data-testid="button-mode-spaced"
                    className="gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    {t('summaryStudy.modeAnki')}
                  </Button>
                  <Button
                    variant={studyMode === "practice" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStudyMode("practice")}
                    data-testid="button-mode-practice"
                    className="gap-2"
                  >
                    <Dumbbell className="w-4 h-4" />
                    {t('summaryStudy.modePractice')}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  data-testid="button-mode-practice"
                  className="gap-2"
                >
                  <Dumbbell className="w-4 h-4" />
                  {t('summaryStudy.modePractice')}
                </Button>
              )}
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
