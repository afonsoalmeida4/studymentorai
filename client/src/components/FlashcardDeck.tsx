import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ApiFlashcard } from "@shared/schema";
import { RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FlipCardItemProps {
  flashcard: ApiFlashcard;
  isReviewed: boolean;
  onToggleReviewed: () => void;
}

function FlipCardItem({ flashcard, isReviewed, onToggleReviewed }: FlipCardItemProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="perspective-1000">
      <div
        className={`relative w-full h-64 transition-transform duration-500 transform-style-preserve-3d cursor-pointer ${
          isFlipped ? "rotate-y-180" : ""
        }`}
        onClick={() => setIsFlipped(!isFlipped)}
        data-testid={`flashcard-${flashcard.id}`}
      >
        {/* Front - Question */}
        <Card
          className={`absolute inset-0 backface-hidden border-2 ${
            isReviewed ? "border-primary/40 bg-primary/5" : "border-border"
          }`}
        >
          <CardContent className="flex flex-col h-full justify-between p-6">
            <div className="flex-1 flex items-center justify-center">
              <p
                className="text-lg font-medium text-center text-foreground"
                data-testid={`question-${flashcard.id}`}
              >
                {flashcard.question}
              </p>
            </div>
            <div className="flex items-center justify-between pt-4 border-t">
              <Badge variant="secondary" className="text-xs">
                {t('flashcards.question')}
              </Badge>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RotateCw className="w-3 h-3" />
                <span>{t('flashcards.clickToFlip')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back - Answer */}
        <Card
          className={`absolute inset-0 backface-hidden rotate-y-180 border-2 ${
            isReviewed ? "border-primary/40 bg-primary/5" : "border-border"
          }`}
        >
          <CardContent className="flex flex-col h-full justify-between p-6">
            <div className="flex-1 flex items-center justify-center">
              <p
                className="text-lg text-center text-foreground"
                data-testid={`answer-${flashcard.id}`}
              >
                {flashcard.answer}
              </p>
            </div>
            <div className="flex items-center justify-between pt-4 border-t">
              <Badge variant="default" className="text-xs">
                {t('flashcards.answer')}
              </Badge>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleReviewed();
                }}
                className="text-xs text-primary hover:underline"
                data-testid={`button-review-${flashcard.id}`}
              >
                {isReviewed ? t('flashcards.markAsUnreviewed') : t('flashcards.markAsReviewed')}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface FlashcardDeckProps {
  flashcards: ApiFlashcard[];
}

export default function FlashcardDeck({ flashcards }: FlashcardDeckProps) {
  const [reviewedCards, setReviewedCards] = useState<Set<string>>(new Set());
  const { t } = useTranslation();

  const handleToggleReviewed = (id: string) => {
    setReviewedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Guard against division by zero
  const progress = flashcards.length > 0 ? (reviewedCards.size / flashcards.length) * 100 : 0;

  // Handle empty flashcards case
  if (flashcards.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>{t('flashcards.noFlashcards')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Tracker */}
      <div className="space-y-2" data-testid="flashcard-progress">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('flashcards.studyProgress')}</span>
          <span className="font-medium text-foreground">
            {reviewedCards.size} / {flashcards.length} {t('flashcards.reviewed')}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Flashcard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {flashcards.map((flashcard) => (
          <FlipCardItem
            key={flashcard.id}
            flashcard={flashcard}
            isReviewed={reviewedCards.has(flashcard.id)}
            onToggleReviewed={() => handleToggleReviewed(flashcard.id)}
          />
        ))}
      </div>
    </div>
  );
}
