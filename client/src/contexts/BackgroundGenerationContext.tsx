import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

type LearningStyle = "visual" | "logico" | "conciso";

interface GenerationTask {
  topicId: string;
  styles: LearningStyle[];
  status: "pending" | "generating" | "completed" | "error";
}

interface BackgroundGenerationContextType {
  isGenerating: (topicId: string) => boolean;
  startGeneration: (topicId: string, styles: LearningStyle[]) => Promise<void>;
  generatingTopics: Set<string>;
}

const BackgroundGenerationContext = createContext<BackgroundGenerationContextType | undefined>(undefined);

export function BackgroundGenerationProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [generatingTopics, setGeneratingTopics] = useState<Set<string>>(new Set());

  const isGenerating = useCallback((topicId: string) => {
    return generatingTopics.has(topicId);
  }, [generatingTopics]);

  const startGeneration = useCallback(async (topicId: string, styles: LearningStyle[]) => {
    if (generatingTopics.has(topicId)) {
      return;
    }

    setGeneratingTopics(prev => new Set(Array.from(prev).concat(topicId)));

    toast({
      title: t('summaries.generatingSummary'),
      description: t('summaries.generatingWait'),
    });

    try {
      for (const style of styles) {
        await apiRequest("POST", `/api/topics/${topicId}/summaries`, { learningStyle: style });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/topics", topicId, "summaries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/topic", topicId, "bundled"] });
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards"], exact: false });

      toast({
        title: styles.length === 1 
          ? t('topicView.generateStylesDialog.successOne') 
          : t('topicView.generateStylesDialog.successMultiple', { count: styles.length }),
        description: styles.length === 1 
          ? t('topicView.generateStylesDialog.successDescriptionOne')
          : t('topicView.generateStylesDialog.successDescriptionMultiple'),
      });
    } catch (error: any) {
      console.error("[BackgroundGeneration] Error:", error);
      toast({
        title: t('errors.generateSummaries'),
        description: error.message || t('errors.tryAgain'),
        variant: "destructive",
      });
    } finally {
      setGeneratingTopics(prev => {
        const next = new Set(prev);
        next.delete(topicId);
        return next;
      });
    }
  }, [generatingTopics, toast, t]);

  return (
    <BackgroundGenerationContext.Provider value={{ isGenerating, startGeneration, generatingTopics }}>
      {children}
    </BackgroundGenerationContext.Provider>
  );
}

export function useBackgroundGeneration() {
  const context = useContext(BackgroundGenerationContext);
  if (!context) {
    throw new Error("useBackgroundGeneration must be used within BackgroundGenerationProvider");
  }
  return context;
}
