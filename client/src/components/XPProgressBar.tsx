import { Progress } from "@/components/ui/progress";

interface XPProgressBarProps {
  currentXp: number;
  nextLevelXp: number;
  currentLevelXp: number;
  progress: number;
  showLabel?: boolean;
}

export function XPProgressBar({
  currentXp,
  nextLevelXp,
  currentLevelXp,
  progress,
  showLabel = true,
}: XPProgressBarProps) {
  return (
    <div className="w-full space-y-0.5 sm:space-y-1" data-testid="xp-progress-bar">
      <div className="relative">
        <Progress value={progress} className="h-1.5 sm:h-2" />
        {showLabel && progress > 0 && progress < 100 && (
          <div
            className="absolute top-0 -translate-x-1/2 hidden sm:block"
            style={{ left: `${Math.min(Math.max(progress, 5), 95)}%` }}
          >
            <div className="flex flex-col items-center -mt-5">
              <span 
                data-testid="text-current-xp" 
                className="text-[10px] sm:text-xs font-bold text-foreground whitespace-nowrap"
              >
                {currentXp} XP
              </span>
              <div className="w-0.5 h-2 sm:h-3 bg-foreground/50"></div>
            </div>
          </div>
        )}
      </div>
      {showLabel && (
        <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground gap-1">
          <span data-testid="text-min-xp" className="flex-shrink-0">{currentLevelXp} XP</span>
          <span data-testid="text-current-xp-mobile" className="font-medium text-foreground sm:hidden">{currentXp} XP</span>
          {nextLevelXp !== Infinity && (
            <span data-testid="text-next-level-xp" className="flex-shrink-0">
              {nextLevelXp} XP
            </span>
          )}
        </div>
      )}
    </div>
  );
}
