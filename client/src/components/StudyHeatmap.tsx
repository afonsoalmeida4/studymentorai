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

  const thumbRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartRef = useRef(0);

  const updateScrollInfo = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setScrollInfo({ scrollLeft, scrollWidth, clientWidth });
      
      if (thumbRef.current && trackRef.current) {
        const trackWidth = trackRef.current.offsetWidth;
        const canScrollNow = scrollWidth > clientWidth;
        const thumbWidthPercent = canScrollNow ? Math.max(20, (clientWidth / scrollWidth) * 100) : 100;
        const thumbWidthPx = (thumbWidthPercent / 100) * trackWidth;
        const maxScroll = scrollWidth - clientWidth;
        const thumbLeftPx = canScrollNow && maxScroll > 0 
          ? (scrollLeft / maxScroll) * (trackWidth - thumbWidthPx)
          : 0;
        
        thumbRef.current.style.width = `${thumbWidthPercent}%`;
        thumbRef.current.style.left = `${thumbLeftPx}px`;
      }
    }
  }, []);

  useEffect(() => {
    updateScrollInfo();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollInfo, { passive: true });
      window.addEventListener('resize', updateScrollInfo);
      return () => {
        container.removeEventListener('scroll', updateScrollInfo);
        window.removeEventListener('resize', updateScrollInfo);
      };
    }
  }, [updateScrollInfo, weeks]);

  useEffect(() => {
    if (scrollInfo.scrollWidth > scrollInfo.clientWidth) {
      requestAnimationFrame(updateScrollInfo);
    }
  }, [scrollInfo.scrollWidth, scrollInfo.clientWidth, updateScrollInfo]);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current || !trackRef.current || isDraggingRef.current) return;
    if (e.target === thumbRef.current) return;
    
    const track = trackRef.current;
    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const { scrollWidth, clientWidth } = scrollContainerRef.current;
    scrollContainerRef.current.scrollLeft = percentage * (scrollWidth - clientWidth);
  };

  const handleThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current || !trackRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    scrollStartRef.current = scrollContainerRef.current.scrollLeft;
    
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !scrollContainerRef.current || !trackRef.current) return;
    e.preventDefault();
    
    const deltaX = e.clientX - dragStartXRef.current;
    const { scrollWidth, clientWidth } = scrollContainerRef.current;
    const trackWidth = trackRef.current.offsetWidth;
    const thumbWidthPercent = Math.max(20, (clientWidth / scrollWidth) * 100);
    const thumbWidthPx = (thumbWidthPercent / 100) * trackWidth;
    const maxThumbMove = trackWidth - thumbWidthPx;
    const maxScroll = scrollWidth - clientWidth;
    
    const scrollDelta = maxThumbMove > 0 ? (deltaX / maxThumbMove) * maxScroll : 0;
    scrollContainerRef.current.scrollLeft = scrollStartRef.current + scrollDelta;
  };

  const handleThumbPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const canScroll = scrollInfo.scrollWidth > scrollInfo.clientWidth;

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
            ref={trackRef}
            className="h-2 bg-muted rounded-full cursor-pointer relative"
            onClick={handleTrackClick}
            data-testid="heatmap-scrollbar-track"
          >
            <div 
              ref={thumbRef}
              className="h-full bg-primary rounded-full absolute cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={handleThumbPointerDown}
              onPointerMove={handleThumbPointerMove}
              onPointerUp={handleThumbPointerUp}
              onPointerCancel={handleThumbPointerUp}
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
