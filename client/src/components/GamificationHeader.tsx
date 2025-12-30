import { useQuery } from "@tanstack/react-query";
import { LevelBadge } from "./LevelBadge";
import { XPProgressBar } from "./XPProgressBar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Trophy, Crown, Star } from "lucide-react";
import { useTranslation } from "react-i18next";

interface GamificationProfile {
  user: {
    totalXp: number;
    currentLevel: string;
  };
  levelInfo: {
    level: string;
    levelNumber: number;
    icon: string;
    name: string;
    progress: number;
    nextLevelXp: number;
    currentLevelXp: number;
    totalLevels: number;
  };
  rank: number | null;
  totalUsers: number;
}

export function GamificationHeader() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<{ success: boolean; profile: GamificationProfile }>({
    queryKey: ["/api/gamification/profile"],
  });

  if (isLoading) {
    return (
      <Card className="p-4 bg-gradient-to-r from-card to-muted/30 border-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-3 flex-1 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </Card>
    );
  }

  if (!data?.success || !data.profile) {
    return null;
  }

  const { user, levelInfo, rank, totalUsers } = data.profile;
  const isTopRank = rank !== null && rank <= 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card 
        className="p-3 sm:p-4 bg-gradient-to-r from-card via-card to-muted/20 border-2 hover:shadow-lg transition-shadow duration-300" 
        data-testid="card-gamification-header"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center justify-between">
            <LevelBadge 
              level={levelInfo.level as any}
              levelName={levelInfo.name}
              size="lg"
            />
            <div className="sm:hidden flex items-center gap-2">
              <LevelNumberBadge levelNumber={levelInfo.levelNumber} totalLevels={levelInfo.totalLevels} />
              <RankBadge rank={rank} totalUsers={totalUsers} />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <XPProgressBar
              currentXp={user.totalXp}
              nextLevelXp={levelInfo.nextLevelXp}
              currentLevelXp={levelInfo.currentLevelXp}
              progress={levelInfo.progress}
              showLabel={true}
            />
          </div>
          
          <div className="hidden sm:flex items-center gap-2">
            <LevelNumberBadge levelNumber={levelInfo.levelNumber} totalLevels={levelInfo.totalLevels} />
            <RankBadge rank={rank} totalUsers={totalUsers} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function LevelNumberBadge({ levelNumber, totalLevels }: { levelNumber: number; totalLevels: number }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.2, type: "spring" }}
      whileHover={{ scale: 1.05 }}
      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border bg-gradient-to-r from-primary/10 to-primary/5 text-primary border-primary/30"
      data-testid="text-level-info"
    >
      <Star className="h-3 w-3" />
      <span>#{String(levelNumber).padStart(2, '0')}</span>
      <span className="text-muted-foreground font-normal">/{totalLevels}</span>
    </motion.div>
  );
}

function RankBadge({ rank, totalUsers }: { rank: number | null; totalUsers: number }) {
  if (rank === null) return null;

  const isTopRank = rank <= 3;
  const getRankIcon = () => {
    if (rank === 1) return <Crown className="h-3 w-3 text-amber-500" />;
    if (rank === 2) return <Trophy className="h-3 w-3 text-slate-400" />;
    if (rank === 3) return <Trophy className="h-3 w-3 text-amber-600" />;
    return <Star className="h-3 w-3 text-muted-foreground" />;
  };

  const getRankColors = () => {
    if (rank === 1) return "bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/50 dark:to-yellow-900/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-600";
    if (rank === 2) return "bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800 dark:to-gray-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600";
    if (rank === 3) return "bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/50 dark:to-amber-900/50 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-600";
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.2, type: "spring" }}
      whileHover={{ scale: 1.05 }}
      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${getRankColors()}`}
      data-testid="text-rank-info"
    >
      {getRankIcon()}
      <span>#{rank}</span>
      <span className="text-muted-foreground font-normal">/{totalUsers}</span>
    </motion.div>
  );
}
