import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

interface KPICardProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  gradientFrom: string;
  gradientTo: string;
  borderColor: string;
  value: string | number;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  delta?: number;
  deltaLabel?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline";
  tooltipContent?: ReactNode;
  progressBar?: {
    value: number;
    gradient?: string;
  };
  circularProgress?: {
    value: number;
    color: string;
  };
  subText?: string;
  children?: ReactNode;
  colSpan?: number;
  testId?: string;
}

function CircularProgress({ value, color, size = 60 }: { value: number; color: string; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          className="text-muted"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold">{value}%</span>
      </div>
    </div>
  );
}

export function KPICard({
  title,
  icon: Icon,
  iconColor,
  gradientFrom,
  gradientTo,
  borderColor,
  value,
  isLoading,
  isError,
  errorMessage = "Error loading",
  isEmpty,
  emptyMessage,
  emptyAction,
  delta,
  deltaLabel,
  badge,
  badgeVariant = "secondary",
  tooltipContent,
  progressBar,
  circularProgress,
  subText,
  children,
  colSpan = 1,
  testId,
}: KPICardProps) {
  const getDeltaColor = (d: number) => {
    if (d === 0) return "text-muted-foreground";
    return d > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
  };

  const getDeltaIcon = (d: number) => {
    if (d === 0) return Minus;
    return d > 0 ? TrendingUp : TrendingDown;
  };

  const colSpanClass = colSpan === 2 ? "sm:col-span-2 lg:col-span-2" : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={colSpanClass}
    >
      <Card 
        className="relative overflow-hidden hover:shadow-lg transition-all duration-300"
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientFrom} ${gradientTo} opacity-10`} />
        <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${gradientFrom} ${gradientTo} rounded-l-md`} />
        
        <CardHeader className="pb-2 px-3 sm:px-4 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} shadow-sm`}>
                <Icon className={`h-4 w-4 ${iconColor}`} />
              </div>
              <CardTitle className="text-xs sm:text-sm font-medium truncate">{title}</CardTitle>
            </div>
            {tooltipContent && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help flex-shrink-0 ml-1 hover:text-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {tooltipContent}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-3 sm:px-4 relative">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-2 w-full" />
            </div>
          ) : isError ? (
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
          ) : isEmpty ? (
            <div className="space-y-2">
              <div className="text-2xl sm:text-3xl font-bold text-muted-foreground/50" data-testid={testId}>
                {value}
              </div>
              {emptyMessage && (
                <p className="text-xs text-muted-foreground">{emptyMessage}</p>
              )}
              {emptyAction}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {circularProgress ? (
                  <CircularProgress value={circularProgress.value} color={circularProgress.color} />
                ) : (
                  <motion.div
                    className="text-2xl sm:text-3xl font-bold"
                    data-testid={testId}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                  >
                    {value}
                  </motion.div>
                )}

                {delta !== undefined && delta !== 0 && (
                  <motion.div
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className={`flex items-center gap-1 text-xs font-semibold ${getDeltaColor(delta)}`}
                  >
                    {getDeltaIcon(delta) === TrendingUp ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : getDeltaIcon(delta) === TrendingDown ? (
                      <TrendingDown className="h-3.5 w-3.5" />
                    ) : (
                      <Minus className="h-3.5 w-3.5" />
                    )}
                    <span>{delta > 0 ? "+" : ""}{deltaLabel}</span>
                  </motion.div>
                )}
              </div>

              {badge && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Badge variant={badgeVariant} className="text-[10px] sm:text-xs">
                    {badge}
                  </Badge>
                </motion.div>
              )}

              {progressBar && (
                <motion.div
                  className="h-2 bg-muted rounded-full overflow-hidden"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  style={{ transformOrigin: "left" }}
                >
                  <motion.div
                    className={`h-full rounded-full ${progressBar.gradient || "bg-gradient-to-r from-primary to-primary/60"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, progressBar.value)}%` }}
                    transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
                  />
                </motion.div>
              )}

              {subText && (
                <p className="text-xs text-muted-foreground">{subText}</p>
              )}

              {children}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
