import { Feather, BookOpen, Brain, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type UserLevel } from "@shared/schema";

interface LevelBadgeProps {
  level: UserLevel;
  levelName: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}

const LEVEL_ICONS = {
  iniciante: Feather,
  explorador: BookOpen,
  mentor: Brain,
  mestre: Rocket,
} as const;

const LEVEL_COLORS = {
  iniciante: "bg-slate-100 text-slate-700 border-slate-300",
  explorador: "bg-blue-100 text-blue-700 border-blue-300",
  mentor: "bg-purple-100 text-purple-700 border-purple-300",
  mestre: "bg-amber-100 text-amber-700 border-amber-300",
} as const;

export function LevelBadge({ level, levelName, size = "md", showName = true }: LevelBadgeProps) {
  const Icon = LEVEL_ICONS[level];
  const colorClass = LEVEL_COLORS[level];
  
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5 sm:h-4 sm:w-4",
    lg: "h-4 w-4 sm:h-5 sm:w-5",
  };
  
  return (
    <Badge 
      variant="outline" 
      className={`${colorClass} gap-1 sm:gap-1.5 font-medium text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 flex-shrink-0`}
      data-testid={`badge-level-${level}`}
    >
      <Icon className={sizeClasses[size]} />
      {showName && <span className="truncate max-w-[60px] sm:max-w-none">{levelName}</span>}
    </Badge>
  );
}
