import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, BarChart3, Trophy, Home } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

interface AppHeaderProps {
  showNavigation?: boolean;
}

export function AppHeader({ showNavigation = true }: AppHeaderProps) {
  const { t } = useTranslation();
  
  return (
    <header className="border-b">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-primary" data-testid="icon-logo" />
          <span className="text-xl font-semibold text-foreground">AI Study Mentor</span>
        </div>
        {showNavigation && (
          <div className="flex items-center gap-2">
            <Link href="/home">
              <Button variant="outline" size="default" data-testid="button-home">
                <Home className="w-4 h-4 mr-2" />
                {t('appHeader.home')}
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="default" data-testid="button-dashboard">
                <BarChart3 className="w-4 h-4 mr-2" />
                {t('appHeader.dashboard')}
              </Button>
            </Link>
            <Link href="/ranking">
              <Button variant="outline" size="default" data-testid="button-ranking">
                <Trophy className="w-4 h-4 mr-2" />
                {t('appHeader.ranking')}
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="default"
              onClick={() => window.location.href = "/api/logout"}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('appHeader.logout')}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
