import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import SubjectView from "@/pages/subject-view";
import TopicView from "@/pages/topic-view";
import ChatView from "@/pages/chat-view";
import Dashboard from "@/pages/dashboard";
import Ranking from "@/pages/ranking";
import RoleSelection from "@/pages/role-selection";
import MyClasses from "@/pages/my-classes";
import NotFound from "@/pages/not-found";
import type { User } from "@shared/schema";

function AuthenticatedRouter() {
  const { user } = useAuth();
  const typedUser = user as User | null;

  if (typedUser && !typedUser.role) {
    return <RoleSelection />;
  }

  return (
    <div className="flex h-screen w-full">
      <AppSidebar />
      <div className="flex flex-col flex-1">
        <header className="flex items-center justify-between p-2 border-b">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
        </header>
        <main className="flex-1 overflow-auto">
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/ranking" component={Ranking} />
            <Route path="/classes" component={MyClasses} />
            <Route path="/subjects" component={SubjectView} />
            <Route path="/subject/:id" component={SubjectView} />
            <Route path="/topic/:id" component={TopicView} />
            <Route path="/chat" component={ChatView} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Landing />;
  }

  return (
    <Switch>
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
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <Toaster />
          <Router />
        </SidebarProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
