// In-memory cache for bundled flashcards (TTL: 60 seconds)
const bundledFlashcardsCache = new Map<string, { data: any; timestamp: number; userId: string }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export const getCache = () => bundledFlashcardsCache;
export const getCacheTTL = () => CACHE_TTL_MS;

// Helper to invalidate cache for a topic
export const invalidateBundledCache = (topicId: string) => {
  const keysToDelete: string[] = [];
  bundledFlashcardsCache.forEach((_, key) => {
    if (key.startsWith(`${topicId}:`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => bundledFlashcardsCache.delete(key));
  if (keysToDelete.length > 0) {
    console.log(`[Cache] Invalidated bundled cache for topic ${topicId} (${keysToDelete.length} entries)`);
  }
};
