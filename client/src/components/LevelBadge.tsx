import { Feather, BookOpen, Brain, Rocket, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type UserLevel } from "@shared/schema";
import { motion } from "framer-motion";

interface LevelBadgeProps {
  level: UserLevel;
  levelName: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  animated?: boolean;
}

const LEVEL_ICONS = {
  iniciante: Feather,
  explorador: BookOpen,
  mentor: Brain,
  mestre: Rocket,
} as const;

const LEVEL_COLORS = {
  iniciante: {
    bg: "bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700",
    text: "text-slate-700 dark:text-slate-200",
    border: "border-slate-300 dark:border-slate-600",
    glow: "shadow-slate-200/50 dark:shadow-slate-700/50",
  },
  explorador: {
    bg: "bg-gradient-to-r from-blue-100 to-sky-100 dark:from-blue-900/50 dark:to-sky-900/50",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-600",
    glow: "shadow-blue-200/50 dark:shadow-blue-700/50",
  },
  mentor: {
    bg: "bg-gradient-to-r from-purple-100 to-violet-100 dark:from-purple-900/50 dark:to-violet-900/50",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-300 dark:border-purple-600",
    glow: "shadow-purple-200/50 dark:shadow-purple-700/50",
  },
  mestre: {
    bg: "bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/50 dark:to-yellow-900/50",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-600",
    glow: "shadow-amber-200/50 dark:shadow-amber-700/50",
  },
} as const;

export function LevelBadge({ level, levelName, size = "md", showName = true, animated = true }: LevelBadgeProps) {
  const Icon = LEVEL_ICONS[level];
  const colors = LEVEL_COLORS[level];
  
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
      {level === "mestre" && <Sparkles className="h-2.5 w-2.5 text-amber-500" />}
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
