import { motion } from "framer-motion";
import { Zap } from "lucide-react";

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
    <div className="w-full space-y-1 sm:space-y-1.5" data-testid="xp-progress-bar">
      <div className="relative">
        <div className="h-2.5 sm:h-3 bg-muted rounded-full overflow-hidden shadow-inner">
          <motion.div
            className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full relative"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.div 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ["0%", "200%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        </div>
        {showLabel && progress > 0 && progress < 100 && (
          <motion.div
            className="absolute top-0 -translate-x-1/2 hidden sm:block"
            style={{ left: `${Math.min(Math.max(progress, 8), 92)}%` }}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex flex-col items-center -mt-6">
              <div className="flex items-center gap-0.5 bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md shadow-lg">
                <Zap className="h-2.5 w-2.5" />
                <span 
                  data-testid="text-current-xp" 
                  className="text-[10px] font-bold whitespace-nowrap"
                >
                  {currentXp}
                </span>
              </div>
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-primary"></div>
            </div>
          </motion.div>
        )}
      </div>
      {showLabel && (
        <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground gap-1">
          <span data-testid="text-min-xp" className="flex-shrink-0 font-medium">{currentLevelXp} XP</span>
          <span data-testid="text-current-xp-mobile" className="font-semibold text-primary sm:hidden flex items-center gap-0.5">
            <Zap className="h-2.5 w-2.5" />
            {currentXp} XP
          </span>
          {nextLevelXp !== Infinity && (
            <span data-testid="text-next-level-xp" className="flex-shrink-0 font-medium">
              {nextLevelXp} XP
            </span>
          )}
        </div>
      )}
    </div>
  );
}
