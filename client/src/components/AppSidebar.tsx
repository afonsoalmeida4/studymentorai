import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { GraduationCap, Plus, BookOpen, Brain, LogOut, Home, BarChart3, Trophy, Crown, CreditCard, CalendarDays, Pencil, Trash2, Shield } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { translateError } from "@/lib/errorTranslation";
import type { Subject, User, Subscription, UsageTracking, SubscriptionPlan } from "@shared/schema";
import { planLimits } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

type SubscriptionDetails = {
  subscription: Subscription;
  usage: UsageTracking;
  limits: typeof planLimits[SubscriptionPlan];
};

export function AppSidebar() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const typedUser = user as User | null;
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectDescription, setNewSubjectDescription] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState("#6366f1");
  
  // Edit/delete subject state
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editSubjectDescription, setEditSubjectDescription] = useState("");
  const [editSubjectColor, setEditSubjectColor] = useState("#6366f1");

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    select: (data: any) => data.subjects || [],
  });

  const { subscription, isLoading: isLoadingSubscription } = useSubscription();
  const hasProOrPremium = subscription?.plan === "pro" || subscription?.plan === "premium";
  const isPremiumOnly = subscription?.plan === "premium";

  // Prefetch data on mouse hover only (not touch) for faster navigation
  // Touch devices tap to navigate, so prefetch would block the interaction
  const handlePrefetch = useCallback((prefetchFn: () => void) => {
    return (e: React.PointerEvent | React.MouseEvent) => {
      // Only prefetch on mouse hover, not touch
      if ('pointerType' in e && e.pointerType === 'touch') return;
      prefetchFn();
    };
  }, []);

  const prefetchDashboard = useCallback(() => {
    queryClient.prefetchQuery({ queryKey: ["/api/stats/study-time"] });
    queryClient.prefetchQuery({ queryKey: ["/api/stats/subject-progress"] });
    queryClient.prefetchQuery({ queryKey: ["/api/stats/streak"] });
  }, []);

  const prefetchFlashcards = useCallback(() => {
    queryClient.prefetchQuery({ queryKey: ["/api/flashcards"] });
  }, []);

  const prefetchRanking = useCallback(() => {
    queryClient.prefetchQuery({ queryKey: ["/api/gamification/leaderboard"] });
  }, []);

  const createSubjectMutation = useMutation({
    mutationFn: async () => {
      console.log("Creating subject:", { name: newSubjectName, description: newSubjectDescription, color: newSubjectColor });
      const result = await apiRequest("POST", "/api/subjects", {
        name: newSubjectName,
        description: newSubjectDescription,
        color: newSubjectColor,
        position: subjects.length,
      });
      console.log("Subject created successfully:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("onSuccess called with data:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      setIsSubjectDialogOpen(false);
      setNewSubjectName("");
      setNewSubjectDescription("");
      setNewSubjectColor("#6366f1");
      toast({
        title: t('subjects.createSuccess'),
        description: t('subjects.createSuccessMessage'),
      });
    },
    onError: (error: any) => {
      console.error("Error creating subject:", error);
      
      // Translate error message using errorCode if available (data comes from apiRequest)
      const translatedError = translateError(t, {
        errorCode: error?.data?.errorCode,
        params: error?.data?.params,
        error: error?.message
      });
      
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: translatedError || t('subjects.createError'),
      });
    },
  });

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubjectName.trim()) {
      createSubjectMutation.mutate();
    }
  };

  // Edit subject mutation
  const editSubjectMutation = useMutation({
    mutationFn: async () => {
      if (!subjectToEdit) return;
      return await apiRequest("PATCH", `/api/subjects/${subjectToEdit.id}`, {
        name: editSubjectName,
        description: editSubjectDescription,
        color: editSubjectColor,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      setSubjectToEdit(null);
      toast({
        title: t('subjects.editSuccess'),
        description: t('subjects.editSuccessMessage'),
      });
    },
    onError: (error: any) => {
      const translatedError = translateError(t, {
        errorCode: error?.data?.errorCode,
        params: error?.data?.params,
        error: error?.message
      });
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: translatedError || t('subjects.editError'),
      });
    },
  });

  // Delete subject mutation
  const deleteSubjectMutation = useMutation({
    mutationFn: async (subjectId: string) => {
      return await apiRequest("DELETE", `/api/subjects/${subjectId}`);
    },
    onSuccess: (_, deletedSubjectId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      // Redirect to home if the deleted subject was currently open
      if (location.startsWith(`/subject/${deletedSubjectId}`) || location.startsWith(`/topic/`)) {
        setLocation("/");
      }
      setSubjectToDelete(null);
      toast({
        title: t('subjects.deleteSuccess'),
        description: t('subjects.deleteSuccessMessage'),
      });
    },
    onError: (error: any) => {
      const translatedError = translateError(t, {
        errorCode: error?.data?.errorCode,
        params: error?.data?.params,
        error: error?.message
      });
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: translatedError || t('subjects.deleteError'),
      });
    },
  });

  const handleEditSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (editSubjectName.trim()) {
      editSubjectMutation.mutate();
    }
  };

  const openEditDialog = (subject: Subject, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSubjectToEdit(subject);
    setEditSubjectName(subject.name);
    setEditSubjectDescription(subject.description || "");
    setEditSubjectColor(subject.color || "#6366f1");
  };

  const openDeleteDialog = (subject: Subject, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSubjectToDelete(subject);
  };

  return (
    <>
      <Sidebar>
        <SidebarHeader className="border-b border-border/50">
          <div className="flex items-center gap-3 p-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500 via-primary to-indigo-600 blur-md opacity-60 rounded-xl animate-pulse" />
              <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 via-primary to-indigo-600 flex items-center justify-center shadow-xl shadow-primary/30 ring-2 ring-white/10">
                <GraduationCap className="w-6 h-6 text-white drop-shadow-sm" data-testid="icon-app-logo" />
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-base tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text">Study Mentor AI</span>
              <span className="text-xs text-muted-foreground/80 truncate font-medium">{t('app.tagline')}</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2">
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-2">{t('nav.navigation')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/"}
                    className={`rounded-lg transition-all duration-200 ${location === "/" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"}`}
                    data-testid="button-home"
                  >
                    <Link href="/">
                      <div className={`p-1.5 rounded-md ${location === "/" ? "bg-primary/20" : "bg-muted/50"}`}>
                        <Home className="w-4 h-4" />
                      </div>
                      <span>{t('nav.home')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/flashcards"}
                    className={`rounded-lg transition-all duration-200 ${location === "/flashcards" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium" : "hover:bg-muted/50"}`}
                    data-testid="button-flashcards"
                    onMouseEnter={prefetchFlashcards}
                  >
                    <Link href="/flashcards">
                      <div className={`p-1.5 rounded-md ${location === "/flashcards" ? "bg-amber-500/20" : "bg-muted/50"}`}>
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <span>{t('nav.flashcards')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {hasProOrPremium && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location === "/dashboard"}
                        className={`rounded-lg transition-all duration-200 ${location === "/dashboard" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium" : "hover:bg-muted/50"}`}
                        data-testid="button-dashboard"
                        onMouseEnter={prefetchDashboard}
                      >
                        <Link href="/dashboard">
                          <div className={`p-1.5 rounded-md ${location === "/dashboard" ? "bg-blue-500/20" : "bg-muted/50"}`}>
                            <BarChart3 className="w-4 h-4" />
                          </div>
                          <span>{t('nav.dashboard')}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location === "/ranking"}
                        className={`rounded-lg transition-all duration-200 ${location === "/ranking" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium" : "hover:bg-muted/50"}`}
                        data-testid="button-ranking"
                        onMouseEnter={prefetchRanking}
                      >
                        <Link href="/ranking">
                          <div className={`p-1.5 rounded-md ${location === "/ranking" ? "bg-emerald-500/20" : "bg-muted/50"}`}>
                            <Trophy className="w-4 h-4" />
                          </div>
                          <span>{t('nav.ranking')}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}
                {isPremiumOnly && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/calendar"}
                      className={`rounded-lg transition-all duration-200 ${location === "/calendar" ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium" : "hover:bg-muted/50"}`}
                      data-testid="button-calendar"
                    >
                      <Link href="/calendar">
                        <div className={`p-1.5 rounded-md ${location === "/calendar" ? "bg-violet-500/20" : "bg-muted/50"}`}>
                          <CalendarDays className="w-4 h-4" />
                        </div>
                        <span>{t('nav.calendar')}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/subscription"}
                    className={`rounded-lg transition-all duration-200 ${location === "/subscription" ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 font-medium" : "hover:bg-muted/50"}`}
                    data-testid="button-subscription"
                  >
                    <Link href="/subscription">
                      <div className={`p-1.5 rounded-md ${location === "/subscription" ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20" : "bg-muted/50"}`}>
                        <Crown className="w-4 h-4" />
                      </div>
                      <span>{t('nav.subscription')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <div className="flex items-center justify-between px-2 mb-1">
              <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{t('nav.subjects')}</SidebarGroupLabel>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                onClick={() => setIsSubjectDialogOpen(true)}
                data-testid="button-add-subject"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {subjects.length === 0 ? (
                  <div className="px-3 py-6 text-sm text-muted-foreground text-center rounded-lg bg-muted/30 mx-2">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    {t('subjects.noSubjects')}
                    <br />
                    <span className="text-xs opacity-70">{t('subjects.clickToStart')}</span>
                  </div>
                ) : (
                  subjects.map((subject) => {
                    const isActive = location === `/subject/${subject.id}`;
                    return (
                      <SidebarMenuItem key={subject.id} className="relative">
                        <div 
                          className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-all duration-200 cursor-pointer ${isActive ? 'bg-gradient-to-r from-primary/15 to-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted/60'}`}
                          onClick={() => setLocation(`/subject/${subject.id}`)}
                          data-testid={`button-subject-${subject.id}`}
                        >
                          <div
                            className="w-4 h-4 rounded-md flex-shrink-0 shadow-sm ring-1 ring-white/20"
                            style={{ 
                              backgroundColor: subject.color ?? "#6366f1",
                              boxShadow: `0 2px 8px ${subject.color ?? "#6366f1"}40`
                            }}
                          />
                          <span className={`flex-1 truncate text-sm ${isActive ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                            {subject.name}
                          </span>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted"
                              onClick={(e) => openEditDialog(subject, e)}
                              data-testid={`button-edit-subject-${subject.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => openDeleteDialog(subject, e)}
                              data-testid={`button-delete-subject-${subject.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </SidebarMenuItem>
                    );
                  })
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {isPremiumOnly && (
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-2">{t('nav.tools')}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/chat"}
                      className={`rounded-lg transition-all duration-200 ${location === "/chat" ? "bg-gradient-to-r from-violet-500/10 to-purple-500/10 text-violet-600 dark:text-violet-400 font-medium" : "hover:bg-muted/50"}`}
                      data-testid="button-ai-chat"
                    >
                      <Link href="/chat">
                        <div className={`p-1.5 rounded-md ${location === "/chat" ? "bg-gradient-to-br from-violet-500/20 to-purple-500/20" : "bg-muted/50"}`}>
                          <Brain className="w-4 h-4" />
                        </div>
                        <span>{t('nav.chat')}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter className="border-t border-border/50 p-2">
          <SidebarMenu className="space-y-0.5">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location === "/privacy"}
                className={`rounded-lg transition-all duration-200 text-sm ${location === "/privacy" ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                data-testid="button-privacy-policy"
              >
                <Link href="/privacy">
                  <Shield className="w-4 h-4" />
                  <span>{t('nav.privacyPolicy')}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => window.location.href = "/api/logout"}
                className="rounded-lg transition-all duration-200 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('nav.logout')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <Dialog open={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen}>
        <DialogContent data-testid="dialog-create-subject">
          <form onSubmit={handleCreateSubject}>
            <DialogHeader>
              <DialogTitle>{t('subjects.newSubject')}</DialogTitle>
              <DialogDescription>
                {t('subjects.createDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="subject-name">{t('subjects.name')}</Label>
                <Input
                  id="subject-name"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder={t('subjects.namePlaceholder')}
                  data-testid="input-subject-name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subject-description">{t('subjects.description')}</Label>
                <Textarea
                  id="subject-description"
                  value={newSubjectDescription}
                  onChange={(e) => setNewSubjectDescription(e.target.value)}
                  placeholder={t('subjects.descriptionPlaceholder')}
                  data-testid="input-subject-description"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subject-color">{t('subjects.color')}</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="subject-color"
                    type="color"
                    value={newSubjectColor}
                    onChange={(e) => setNewSubjectColor(e.target.value)}
                    className="w-20 h-9"
                    data-testid="input-subject-color"
                  />
                  <span className="text-sm text-muted-foreground">{newSubjectColor}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSubjectDialogOpen(false)}
                data-testid="button-cancel-subject"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!newSubjectName.trim() || createSubjectMutation.isPending}
                data-testid="button-submit-subject"
              >
                {createSubjectMutation.isPending ? t('subjects.creating') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Subject Dialog */}
      <Dialog open={!!subjectToEdit} onOpenChange={(open) => !open && setSubjectToEdit(null)}>
        <DialogContent data-testid="dialog-edit-subject">
          <form onSubmit={handleEditSubject}>
            <DialogHeader>
              <DialogTitle>{t('subjects.editSubject')}</DialogTitle>
              <DialogDescription>
                {t('subjects.editDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-subject-name">{t('subjects.name')}</Label>
                <Input
                  id="edit-subject-name"
                  value={editSubjectName}
                  onChange={(e) => setEditSubjectName(e.target.value)}
                  placeholder={t('subjects.namePlaceholder')}
                  data-testid="input-edit-subject-name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-subject-description">{t('subjects.description')}</Label>
                <Textarea
                  id="edit-subject-description"
                  value={editSubjectDescription}
                  onChange={(e) => setEditSubjectDescription(e.target.value)}
                  placeholder={t('subjects.descriptionPlaceholder')}
                  data-testid="input-edit-subject-description"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-subject-color">{t('subjects.color')}</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="edit-subject-color"
                    type="color"
                    value={editSubjectColor}
                    onChange={(e) => setEditSubjectColor(e.target.value)}
                    className="w-20 h-9"
                    data-testid="input-edit-subject-color"
                  />
                  <span className="text-sm text-muted-foreground">{editSubjectColor}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSubjectToEdit(null)}
                data-testid="button-cancel-edit-subject"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!editSubjectName.trim() || editSubjectMutation.isPending}
                data-testid="button-submit-edit-subject"
              >
                {editSubjectMutation.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Subject Confirmation Dialog */}
      <AlertDialog open={!!subjectToDelete} onOpenChange={(open) => !open && setSubjectToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-subject">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('subjects.deleteSubject')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('subjects.deleteConfirmation', { name: subjectToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-subject">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (subjectToDelete) {
                  deleteSubjectMutation.mutate(subjectToDelete.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-subject"
            >
              {deleteSubjectMutation.isPending ? t('common.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
