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
  
  const iconSize = size === "sm" ? 12 : size === "lg" ? 18 : 14;
  
  return (
    <Badge 
      variant="outline" 
      className={`${colorClass} gap-1.5 font-medium`}
      data-testid={`badge-level-${level}`}
    >
      <Icon className={`h-${iconSize} w-${iconSize}`} />
      {showName && <span>{levelName}</span>}
    </Badge>
  );
}
