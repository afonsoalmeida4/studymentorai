import { useQuery } from "@tanstack/react-query";
import { LevelBadge } from "./LevelBadge";
import { XPProgressBar } from "./XPProgressBar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface GamificationProfile {
  user: {
    totalXp: number;
    currentLevel: string;
  };
  levelInfo: {
    level: string;
    icon: string;
    name: string;
    progress: number;
    nextLevelXp: number;
    currentLevelXp: number;
  };
  rank: number | null;
  totalUsers: number;
}

export function GamificationHeader() {
  const { data, isLoading } = useQuery<{ success: boolean; profile: GamificationProfile }>({
    queryKey: ["/api/gamification/profile"],
  });

  if (isLoading) {
    return (
      <Card className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-2 flex-1" />
        </div>
      </Card>
    );
  }

  if (!data?.success || !data.profile) {
    return null;
  }

  const { user, levelInfo, rank, totalUsers } = data.profile;

  return (
    <Card className="p-3" data-testid="card-gamification-header">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center justify-between">
          <LevelBadge 
            level={levelInfo.level as any}
            levelName={levelInfo.name}
          />
          <div className="text-xs text-muted-foreground sm:hidden" data-testid="text-rank-info-mobile">
            {rank !== null && <span>#{rank}/{totalUsers}</span>}
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
        
        <div className="text-sm text-muted-foreground flex-shrink-0 hidden sm:block" data-testid="text-rank-info">
          {rank !== null && <span>#{rank}/{totalUsers}</span>}
        </div>
      </div>
    </Card>
  );
}
