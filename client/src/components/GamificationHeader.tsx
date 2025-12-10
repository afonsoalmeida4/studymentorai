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
      <Card className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <Skeleton className="h-5 w-16 sm:h-6 sm:w-24" />
          <Skeleton className="h-2 flex-1" />
          <Skeleton className="h-5 w-14 sm:h-6 sm:w-20" />
        </div>
      </Card>
    );
  }

  if (!data?.success || !data.profile) {
    return null;
  }

  const { user, levelInfo, rank, totalUsers } = data.profile;

  return (
    <Card className="p-3 sm:p-4" data-testid="card-gamification-header">
      <div className="flex items-center gap-2 sm:gap-4">
        <LevelBadge 
          level={levelInfo.level as any}
          levelName={levelInfo.name}
        />
        
        <div className="flex-1 min-w-0">
          <XPProgressBar
            currentXp={user.totalXp}
            nextLevelXp={levelInfo.nextLevelXp}
            currentLevelXp={levelInfo.currentLevelXp}
            progress={levelInfo.progress}
            showLabel={true}
          />
        </div>
        
        <div className="text-xs sm:text-sm text-muted-foreground flex-shrink-0 hidden xs:block" data-testid="text-rank-info">
          {rank !== null && (
            <span>
              #{rank}/{totalUsers}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
