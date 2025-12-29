import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useAuth } from "@/hooks/useAuth";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { useEffect, lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";
import type { User } from "@shared/schema";
import "@/lib/i18n";

// Lazy load heavy pages for faster initial load
const SubjectView = lazy(() => import("@/pages/subject-view"));
const TopicView = lazy(() => import("@/pages/topic-view"));
const ChatView = lazy(() => import("@/pages/chat-view"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Ranking = lazy(() => import("@/pages/ranking"));
const FlashcardsPage = lazy(() => import("@/pages/flashcards"));
const CalendarPage = lazy(() => import("@/pages/calendar"));
const SubscriptionPage = lazy(() => import("@/pages/subscription"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const AuthPage = lazy(() => import("@/pages/auth"));

// Fast loading fallback
function PageLoader() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function AuthenticatedRouter() {
  const { user } = useAuth();
  const typedUser = user as User | null;
  const [location, setLocation] = useLocation();
  
  useLanguageSync();

  // Clean up auth success param after successful OAuth login
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('auth')) {
      // Remove auth param from URL without reload
      params.delete('auth');
      const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
      window.history.replaceState({}, '', newUrl);
      
      // Clear any router history to prevent FREE users from loading existential threads
      console.log('[AUTH] Cleaned auth param and reset router history');
    }
  }, [location]);

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
          <header className="flex items-center justify-between px-2 sm:px-3 py-2 border-b gap-2 min-h-[44px] sm:min-h-[48px]" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0" />
            </div>
            <LanguageSelector />
          </header>
          <main className="flex-1 overflow-x-hidden overflow-y-auto min-w-0">
            <Suspense fallback={<PageLoader />}>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/ranking" component={Ranking} />
                <Route path="/flashcards" component={FlashcardsPage} />
                <Route path="/calendar" component={CalendarPage} />
                <Route path="/subscription" component={SubscriptionPage} />
                <Route path="/subjects" component={SubjectView} />
                <Route path="/subject/:id" component={SubjectView} />
                <Route path="/topic/:id" component={TopicView} />
                <Route path="/chat" component={ChatView} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Landing />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/auth" component={AuthPage} />
        {!isAuthenticated ? (
          <>
            <Route path="/" component={Landing} />
            <Route path="/subject/:id" component={Landing} />
            <Route path="/topic/:id" component={Landing} />
            <Route path="/chat" component={Landing} />
          </>
        ) : (
          <Route>
            <AuthenticatedRouter />
          </Route>
        )}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
