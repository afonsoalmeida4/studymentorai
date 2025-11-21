import type { FlashcardAttempt } from "@shared/schema";

export interface SchedulingResult {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewDate: Date;
}

export function calculateNextReview(
  rating: number,
  previousAttempt: FlashcardAttempt | null,
): SchedulingResult {
  const now = new Date();
  
  let easeFactor = previousAttempt?.easeFactor ?? 250;
  let repetitions = previousAttempt?.repetitions ?? 0;
  let intervalDays = previousAttempt?.intervalDays ?? 0;

  if (rating < 3) {
    repetitions = 0;
    intervalDays = 1;
    easeFactor = Math.round(
      easeFactor + (10 - (4 - rating) * (8 + (4 - rating) * 2))
    );
    easeFactor = Math.max(130, easeFactor);
  } else {
    repetitions += 1;
    
    easeFactor = Math.round(
      easeFactor + (10 - (4 - rating) * (8 + (4 - rating) * 2))
    );
    easeFactor = Math.max(130, easeFactor);
    
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * (easeFactor / 100));
    }
  }

  // Guard against negative or zero intervals
  intervalDays = Math.max(1, intervalDays);

  const nextReviewDate = new Date(now);
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

  return {
    easeFactor,
    intervalDays,
    repetitions,
    nextReviewDate,
  };
}
