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
    <div className="w-full space-y-1" data-testid="xp-progress-bar">
      <div className="relative">
        <Progress value={progress} className="h-2" />
        {showLabel && progress > 0 && progress < 100 && (
          <div
            className="absolute top-0 -translate-x-1/2"
            style={{ left: `${Math.min(Math.max(progress, 5), 95)}%` }}
          >
            <div className="flex flex-col items-center -mt-5">
              <span 
                data-testid="text-current-xp" 
                className="text-xs font-bold text-foreground whitespace-nowrap"
              >
                {currentXp} XP
              </span>
              <div className="w-0.5 h-3 bg-foreground/50"></div>
            </div>
          </div>
        )}
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span data-testid="text-min-xp">{currentLevelXp} XP</span>
          {nextLevelXp !== Infinity && (
            <span data-testid="text-next-level-xp">
              {nextLevelXp} XP
            </span>
          )}
        </div>
      )}
    </div>
  );
}
