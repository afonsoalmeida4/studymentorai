import { GraduationCap } from "lucide-react";

export function AppHeader() {
  return (
    <header className="border-b">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
        <GraduationCap className="w-8 h-8 text-primary" data-testid="icon-logo" />
        <span className="text-xl font-semibold text-foreground">Study AI Mentor</span>
      </div>
    </header>
  );
}
