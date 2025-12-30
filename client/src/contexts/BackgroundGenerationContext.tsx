import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

type LearningStyle = "visual" | "logico" | "conciso";

interface GenerationResult {
  style: LearningStyle;
  success: boolean;
  error?: string;
}

interface BackgroundGenerationContextType {
  isGenerating: (topicId: string) => boolean;
  startGeneration: (topicId: string, styles: LearningStyle[]) => void;
  generatingTopics: Set<string>;
}

const BackgroundGenerationContext = createContext<BackgroundGenerationContextType | undefined>(undefined);

export function BackgroundGenerationProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [generatingTopics, setGeneratingTopics] = useState<Set<string>>(new Set());
  const pendingStylesRef = useRef<Map<string, Set<LearningStyle>>>(new Map());
  const processingRef = useRef<Set<string>>(new Set());

  const isGenerating = useCallback((topicId: string) => {
    return generatingTopics.has(topicId);
  }, [generatingTopics]);

  const processGeneration = useCallback(async (topicId: string) => {
    if (processingRef.current.has(topicId)) {
      return;
    }

    const pendingStyles = pendingStylesRef.current.get(topicId);
    if (!pendingStyles || pendingStyles.size === 0) {
      return;
    }

    processingRef.current.add(topicId);
    setGeneratingTopics(prev => new Set(Array.from(prev).concat(topicId)));

    const stylesToProcess = Array.from(pendingStyles);
    pendingStylesRef.current.set(topicId, new Set());

    toast({
      title: t('summaries.generatingSummary'),
      description: t('summaries.generatingWait'),
    });

    const results: GenerationResult[] = [];

    try {
      const currentLanguage = i18n.language;
      for (const style of stylesToProcess) {
        try {
          await apiRequest("POST", `/api/topics/${topicId}/summaries`, { learningStyle: style, language: currentLanguage });
          results.push({ style, success: true });
        } catch (error: any) {
          console.error(`[BackgroundGeneration] Error generating ${style}:`, error);
          const errorMessage = error?.message || (typeof error === 'string' ? error : undefined);
          results.push({ style, success: false, error: errorMessage });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      // Invalidate cache for current language
      queryClient.invalidateQueries({ queryKey: ["/api/topics", topicId, "summaries", "pt"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", topicId, "summaries", currentLanguage] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", topicId, "summaries"] });
      // Invalidate all language variants for flashcards
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/topic", topicId, "bundled", "pt"] });
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/topic", topicId, "bundled", currentLanguage] });
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/topic", topicId, "bundled"] });
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards"], exact: false });

      if (successCount > 0 && failureCount === 0) {
        toast({
          title: successCount === 1 
            ? t('topicView.generateStylesDialog.successOne') 
            : t('topicView.generateStylesDialog.successMultiple', { count: successCount }),
          description: successCount === 1 
            ? t('topicView.generateStylesDialog.successDescriptionOne')
            : t('topicView.generateStylesDialog.successDescriptionMultiple'),
        });
      } else if (successCount > 0 && failureCount > 0) {
        toast({
          title: t('topicView.generateStylesDialog.partialSuccess', { success: successCount, failed: failureCount }),
          description: t('topicView.generateStylesDialog.partialSuccessDescription'),
          variant: "default",
        });
      } else {
        const firstError = results.find(r => r.error)?.error;
        toast({
          title: t('errors.generateSummaries'),
          description: firstError || t('errors.tryAgain'),
          variant: "destructive",
        });
      }
    } finally {
      processingRef.current.delete(topicId);

      const remainingStyles = pendingStylesRef.current.get(topicId);
      if (remainingStyles && remainingStyles.size > 0) {
        processGeneration(topicId);
      } else {
        setGeneratingTopics(prev => {
          const next = new Set(prev);
          next.delete(topicId);
          return next;
        });
      }
    }
  }, [toast, t, i18n.language]);

  const startGeneration = useCallback((topicId: string, styles: LearningStyle[]) => {
    const currentPending = pendingStylesRef.current.get(topicId) || new Set();
    styles.forEach(style => currentPending.add(style));
    pendingStylesRef.current.set(topicId, currentPending);

    processGeneration(topicId);
  }, [processGeneration]);

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
