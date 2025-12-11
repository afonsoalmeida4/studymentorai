import { useState, useEffect, useCallback } from "react";

interface FlashcardProgress {
  currentIndex: number;
  completedCount: number;
  sessionTime: number;
  completedCardIds: string[];
  lastUpdated: number;
}

const STORAGE_KEY_PREFIX = "flashcard_progress_";
const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours

function getStorageKey(topicId: string, mode: string): string {
  return `${STORAGE_KEY_PREFIX}${topicId}_${mode}`;
}

export function useFlashcardProgress(topicId: string, mode: string) {
  const [progress, setProgress] = useState<FlashcardProgress>({
    currentIndex: 0,
    completedCount: 0,
    sessionTime: 0,
    completedCardIds: [],
    lastUpdated: Date.now(),
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load progress from localStorage on mount
  useEffect(() => {
    const key = getStorageKey(topicId, mode);
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed: FlashcardProgress = JSON.parse(stored);
        // Check if progress is still valid (not expired)
        if (Date.now() - parsed.lastUpdated < EXPIRY_TIME) {
          setProgress(parsed);
        } else {
          // Expired, remove it
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.error("Error loading flashcard progress:", e);
    }
    setIsLoaded(true);
  }, [topicId, mode]);

  // Save progress to localStorage whenever it changes
  const saveProgress = useCallback((newProgress: Partial<FlashcardProgress>) => {
    setProgress(prev => {
      const updated = {
        ...prev,
        ...newProgress,
        lastUpdated: Date.now(),
      };
      const key = getStorageKey(topicId, mode);
      try {
        localStorage.setItem(key, JSON.stringify(updated));
      } catch (e) {
        console.error("Error saving flashcard progress:", e);
      }
      return updated;
    });
  }, [topicId, mode]);

  // Reset progress (explicit restart)
  const resetProgress = useCallback(() => {
    const newProgress: FlashcardProgress = {
      currentIndex: 0,
      completedCount: 0,
      sessionTime: 0,
      completedCardIds: [],
      lastUpdated: Date.now(),
    };
    setProgress(newProgress);
    const key = getStorageKey(topicId, mode);
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error("Error resetting flashcard progress:", e);
    }
  }, [topicId, mode]);

  return {
    progress,
    saveProgress,
    resetProgress,
    isLoaded,
  };
}
