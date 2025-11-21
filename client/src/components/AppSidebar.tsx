import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GraduationCap, Plus, BookOpen, Brain, LogOut, Home, BarChart3, Trophy, Crown, CreditCard } from "lucide-react";
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

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    select: (data: any) => data.subjects || [],
  });

  const { subscription, isLoading: isLoadingSubscription } = useSubscription();
  const hasProOrPremium = subscription?.plan === "pro" || subscription?.plan === "premium";
  const isPremiumOnly = subscription?.plan === "premium";

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
      
      // Translate error message using errorCode if available
      const translatedError = translateError(t, {
        errorCode: error?.errorCode,
        params: error?.params,
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
                {hasProOrPremium && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location === "/dashboard"}
                        data-testid="button-dashboard"
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
                      >
                        <Link href="/ranking">
                          <Trophy className="w-4 h-4" />
                          <span>{t('nav.ranking')}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={location === "/flashcards"}
                        data-testid="button-flashcards"
                      >
                        <Link href="/flashcards">
                          <CreditCard className="w-4 h-4" />
                          <span>{t('nav.flashcards')}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
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
                    <SidebarMenuItem key={subject.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === `/subject/${subject.id}`}
                        data-testid={`button-subject-${subject.id}`}
                      >
                        <Link href={`/subject/${subject.id}`}>
                          <div
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: subject.color ?? "#6366f1" }}
                          />
                          <span>{subject.name}</span>
                        </Link>
                      </SidebarMenuButton>
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
    </>
  );
}
