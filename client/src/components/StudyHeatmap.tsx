import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import type { FlashcardHeatmapData } from "@shared/schema";

interface StudyHeatmapProps {
  data: FlashcardHeatmapData[];
  isLoading?: boolean;
}

const INTENSITY_COLORS = [
  "bg-muted",
  "bg-orange-200 dark:bg-orange-900",
  "bg-orange-400 dark:bg-orange-700",
  "bg-orange-500 dark:bg-orange-500",
  "bg-red-600 dark:bg-red-500",
];

export function StudyHeatmap({ data, isLoading }: StudyHeatmapProps) {
  const { t, i18n } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollInfo, setScrollInfo] = useState({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });

  const weeks = useMemo(() => {
    if (!data || data.length === 0) return [];

    const weekData: FlashcardHeatmapData[][] = [];
    let currentWeek: FlashcardHeatmapData[] = [];

    data.forEach((day, index) => {
      const date = new Date(day.date);
      const dayOfWeek = date.getDay();

      if (index === 0 && dayOfWeek !== 0) {
        for (let i = 0; i < dayOfWeek; i++) {
          currentWeek.push({ date: "", cardsReviewed: 0, intensity: -1 });
        }
      }

      currentWeek.push(day);

      if (dayOfWeek === 6 || index === data.length - 1) {
        if (index === data.length - 1 && dayOfWeek !== 6) {
          for (let i = dayOfWeek + 1; i <= 6; i++) {
            currentWeek.push({ date: "", cardsReviewed: 0, intensity: -1 });
          }
        }
        weekData.push(currentWeek);
        currentWeek = [];
      }
    });

    return weekData;
  }, [data]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString(i18n.language, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const updateScrollInfo = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setScrollInfo({ scrollLeft, scrollWidth, clientWidth });
    }
  }, []);

  useEffect(() => {
    updateScrollInfo();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollInfo);
      window.addEventListener('resize', updateScrollInfo);
      return () => {
        container.removeEventListener('scroll', updateScrollInfo);
        window.removeEventListener('resize', updateScrollInfo);
      };
    }
  }, [updateScrollInfo, weeks]);

  const handleScrollbarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const { scrollWidth, clientWidth } = scrollContainerRef.current;
    scrollContainerRef.current.scrollLeft = percentage * (scrollWidth - clientWidth);
  };

  const canScroll = scrollInfo.scrollWidth > scrollInfo.clientWidth;
  const thumbWidth = canScroll 
    ? Math.max(30, (scrollInfo.clientWidth / scrollInfo.scrollWidth) * 100)
    : 100;
  const thumbPosition = canScroll
    ? (scrollInfo.scrollLeft / (scrollInfo.scrollWidth - scrollInfo.clientWidth)) * (100 - thumbWidth)
    : 0;

  if (isLoading) {
    return (
      <div className="flex gap-0.5 overflow-x-auto pb-2">
        {Array.from({ length: 52 }).map((_, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-0.5">
            {Array.from({ length: 7 }).map((_, dayIndex) => (
              <div
                key={dayIndex}
                className="w-3 h-3 rounded-sm bg-muted animate-pulse"
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2">
        <div 
          ref={scrollContainerRef}
          className="flex gap-0.5 overflow-x-auto pb-1 hide-scrollbar"
        >
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-0.5">
              {week.map((day, dayIndex) => (
                <Tooltip key={dayIndex}>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-3 h-3 rounded-sm transition-colors cursor-default ${
                        day.intensity === -1
                          ? "bg-transparent"
                          : INTENSITY_COLORS[day.intensity] || INTENSITY_COLORS[0]
                      }`}
                      data-testid={`heatmap-day-${day.date || "empty"}`}
                    />
                  </TooltipTrigger>
                  {day.date && (
                    <TooltipContent side="top" className="text-xs">
                      <p className="font-medium">{formatDate(day.date)}</p>
                      <p className="text-muted-foreground">
                        {day.cardsReviewed} {t("flashcardStats.cards")}
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
            </div>
          ))}
        </div>
        {canScroll && (
          <div 
            className="h-2 bg-muted rounded-full cursor-pointer relative"
            onClick={handleScrollbarClick}
            data-testid="heatmap-scrollbar-track"
          >
            <div 
              className="h-full bg-primary rounded-full absolute transition-all duration-100"
              style={{ 
                width: `${thumbWidth}%`,
                left: `${thumbPosition}%`
              }}
              data-testid="heatmap-scrollbar-thumb"
            />
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t("flashcardStats.less")}</span>
          <div className="flex gap-0.5">
            {INTENSITY_COLORS.map((color, index) => (
              <div key={index} className={`w-3 h-3 rounded-sm ${color}`} />
            ))}
          </div>
          <span>{t("flashcardStats.more")}</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
