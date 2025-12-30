import { Feather, BookOpen, Brain, Rocket, Sparkles, Compass, Target, Award, Trophy, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface LevelBadgeProps {
  level: string;
  levelName: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  animated?: boolean;
}

// Map icon names from backend to React components
const ICON_MAP: Record<string, any> = {
  feather: Feather,
  "book-open": BookOpen,
  compass: Compass,
  target: Target,
  brain: Brain,
  award: Award,
  trophy: Trophy,
  sparkles: Sparkles,
  crown: Crown,
  rocket: Rocket,
};

// Get color scheme based on level number
function getColorScheme(level: string) {
  // Extract level number from "level_X" format
  const match = level.match(/level_(\d+)/);
  const levelNum = match ? parseInt(match[1]) : 1;
  
  if (levelNum >= 45) {
    // Legendary (45-50)
    return {
      bg: "bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/50 dark:to-yellow-900/50",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-300 dark:border-amber-600",
      glow: "shadow-amber-200/50 dark:shadow-amber-700/50",
      isMax: levelNum === 50,
    };
  } else if (levelNum >= 40) {
    // Master (40-44)
    return {
      bg: "bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/50 dark:to-orange-900/50",
      text: "text-yellow-700 dark:text-yellow-300",
      border: "border-yellow-300 dark:border-yellow-600",
      glow: "shadow-yellow-200/50 dark:shadow-yellow-700/50",
      isMax: false,
    };
  } else if (levelNum >= 30) {
    // Expert (30-39)
    return {
      bg: "bg-gradient-to-r from-rose-100 to-pink-100 dark:from-rose-900/50 dark:to-pink-900/50",
      text: "text-rose-700 dark:text-rose-300",
      border: "border-rose-300 dark:border-rose-600",
      glow: "shadow-rose-200/50 dark:shadow-rose-700/50",
      isMax: false,
    };
  } else if (levelNum >= 20) {
    // Advanced (20-29)
    return {
      bg: "bg-gradient-to-r from-purple-100 to-violet-100 dark:from-purple-900/50 dark:to-violet-900/50",
      text: "text-purple-700 dark:text-purple-300",
      border: "border-purple-300 dark:border-purple-600",
      glow: "shadow-purple-200/50 dark:shadow-purple-700/50",
      isMax: false,
    };
  } else if (levelNum >= 10) {
    // Intermediate (10-19)
    return {
      bg: "bg-gradient-to-r from-blue-100 to-sky-100 dark:from-blue-900/50 dark:to-sky-900/50",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-blue-300 dark:border-blue-600",
      glow: "shadow-blue-200/50 dark:shadow-blue-700/50",
      isMax: false,
    };
  } else if (levelNum >= 5) {
    // Beginner+ (5-9)
    return {
      bg: "bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-300 dark:border-emerald-600",
      glow: "shadow-emerald-200/50 dark:shadow-emerald-700/50",
      isMax: false,
    };
  } else {
    // Starter (1-4)
    return {
      bg: "bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700",
      text: "text-slate-700 dark:text-slate-200",
      border: "border-slate-300 dark:border-slate-600",
      glow: "shadow-slate-200/50 dark:shadow-slate-700/50",
      isMax: false,
    };
  }
}

export function LevelBadge({ level, levelName, size = "md", showName = true, animated = true }: LevelBadgeProps) {
  const colors = getColorScheme(level);
  
  // Default to Feather icon if not found
  const Icon = Feather;
  
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5 sm:h-4 sm:w-4",
    lg: "h-4 w-4 sm:h-5 sm:w-5",
  };

  const BadgeContent = (
    <Badge 
      variant="outline" 
      className={`${colors.bg} ${colors.text} ${colors.border} gap-1 sm:gap-1.5 font-medium text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 flex-shrink-0 shadow-sm ${colors.glow}`}
      data-testid={`badge-level-${level}`}
    >
      <Icon className={sizeClasses[size]} />
      {showName && <span className="truncate max-w-[60px] sm:max-w-none">{levelName}</span>}
      {colors.isMax && <Sparkles className="h-2.5 w-2.5 text-amber-500" />}
    </Badge>
  );

  if (animated) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, type: "spring" }}
        whileHover={{ scale: 1.05 }}
      >
        {BadgeContent}
      </motion.div>
    );
  }
  
  return BadgeContent;
}
