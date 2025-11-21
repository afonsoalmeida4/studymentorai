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
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-2 flex-1" />
          <Skeleton className="h-6 w-20" />
        </div>
      </Card>
    );
  }

  if (!data?.success || !data.profile) {
    return null;
  }

  const { user, levelInfo, rank, totalUsers } = data.profile;

  return (
    <Card className="p-4" data-testid="card-gamification-header">
      <div className="flex items-center gap-4">
        <LevelBadge 
          level={levelInfo.level as any}
          levelName={levelInfo.name}
        />
        
        <div className="flex-1">
          <XPProgressBar
            currentXp={user.totalXp}
            nextLevelXp={levelInfo.nextLevelXp}
            currentLevelXp={levelInfo.currentLevelXp}
            progress={levelInfo.progress}
            showLabel={true}
          />
        </div>
        
        <div className="text-sm text-muted-foreground" data-testid="text-rank-info">
          {rank !== null && (
            <span>
              #{rank} de {totalUsers}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
