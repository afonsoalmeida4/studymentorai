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
      <Progress value={progress} className="h-2" />
      {showLabel && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span data-testid="text-min-xp">{currentLevelXp} XP</span>
          <span data-testid="text-current-xp" className="font-semibold text-foreground">
            {currentXp} XP
          </span>
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
