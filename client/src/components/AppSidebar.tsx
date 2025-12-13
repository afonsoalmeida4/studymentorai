import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { GraduationCap, Plus, BookOpen, Brain, LogOut, Home, BarChart3, Trophy, Crown, CreditCard, CalendarDays, Pencil, Trash2 } from "lucide-react";
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
  const [location] = useLocation();
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

  // Prefetch data on hover for faster navigation
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
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
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <GraduationCap className="w-6 h-6 text-primary" data-testid="icon-app-logo" />
            <div className="flex flex-col">
              <span className="font-semibold text-sm">AI Study Mentor</span>
              <span className="text-xs text-muted-foreground">{t('app.tagline')}</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t('nav.navigation')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/"}
                    data-testid="button-home"
                  >
                    <Link href="/">
                      <Home className="w-4 h-4" />
                      <span>{t('nav.home')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/flashcards"}
                    data-testid="button-flashcards"
                    onMouseEnter={prefetchFlashcards}
                  >
                    <Link href="/flashcards">
                      <CreditCard className="w-4 h-4" />
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
                        data-testid="button-dashboard"
                        onMouseEnter={prefetchDashboard}
                      >
                        <Link href="/dashboard">
                          <BarChart3 className="w-4 h-4" />
                          <span>{t('nav.dashboard')}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location === "/ranking"}
                        data-testid="button-ranking"
                        onMouseEnter={prefetchRanking}
                      >
                        <Link href="/ranking">
                          <Trophy className="w-4 h-4" />
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
                      data-testid="button-calendar"
                    >
                      <Link href="/calendar">
                        <CalendarDays className="w-4 h-4" />
                        <span>{t('nav.calendar')}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/subscription"}
                    data-testid="button-subscription"
                  >
                    <Link href="/subscription">
                      <Crown className="w-4 h-4" />
                      <span>{t('nav.subscription')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <div className="flex items-center justify-between px-2">
              <SidebarGroupLabel>{t('nav.subjects')}</SidebarGroupLabel>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setIsSubjectDialogOpen(true)}
                data-testid="button-add-subject"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <SidebarGroupContent>
              <SidebarMenu>
                {subjects.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    {t('subjects.noSubjects')}
                    <br />
                    {t('subjects.clickToStart')}
                  </div>
                ) : (
                  subjects.map((subject) => (
                    <SidebarMenuItem key={subject.id} className="group">
                      <SidebarMenuButton
                        asChild
                        isActive={location === `/subject/${subject.id}`}
                        data-testid={`button-subject-${subject.id}`}
                      >
                        <Link href={`/subject/${subject.id}`}>
                          <div
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: subject.color ?? "#6366f1" }}
                          />
                          <span className="flex-1 truncate">{subject.name}</span>
                        </Link>
                      </SidebarMenuButton>
                      <div className="invisible group-hover:visible flex items-center absolute right-1 top-1/2 -translate-y-1/2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => openEditDialog(subject, e)}
                          data-testid={`button-edit-subject-${subject.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={(e) => openDeleteDialog(subject, e)}
                          data-testid={`button-delete-subject-${subject.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {isPremiumOnly && (
            <SidebarGroup>
              <SidebarGroupLabel>{t('nav.tools')}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/chat"}
                      data-testid="button-ai-chat"
                    >
                      <Link href="/chat">
                        <Brain className="w-4 h-4" />
                        <span>{t('nav.chat')}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => window.location.href = "/api/logout"}
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
