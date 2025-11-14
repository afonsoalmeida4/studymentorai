import { useState } from "react";
import { GraduationCap, Plus, BookOpen, Brain, LogOut, Home, BarChart3, Trophy } from "lucide-react";
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
import { useLocation } from "wouter";
import type { Subject } from "@shared/schema";

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectDescription, setNewSubjectDescription] = useState("");
  const [newSubjectColor, setNewSubjectColor] = useState("#6366f1");

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    select: (data: any) => data.subjects || [],
  });

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
        title: "Disciplina criada!",
        description: "A sua nova disciplina foi adicionada com sucesso.",
      });
    },
    onError: (error: any) => {
      console.error("Error creating subject:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error?.message || "Não foi possível criar a disciplina.",
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
              <span className="text-xs text-muted-foreground">Organiza. Equilibra.</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navegação</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setLocation("/")}
                    isActive={location === "/"}
                    data-testid="button-home"
                  >
                    <Home className="w-4 h-4" />
                    <span>Início</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setLocation("/dashboard")}
                    isActive={location === "/dashboard"}
                    data-testid="button-dashboard"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setLocation("/ranking")}
                    isActive={location === "/ranking"}
                    data-testid="button-ranking"
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Ranking</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <div className="flex items-center justify-between px-2">
              <SidebarGroupLabel>Disciplinas</SidebarGroupLabel>
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
                    Nenhuma disciplina criada.
                    <br />
                    Clique em + para começar.
                  </div>
                ) : (
                  subjects.map((subject) => (
                    <SidebarMenuItem key={subject.id}>
                      <SidebarMenuButton
                        onClick={() => setLocation(`/subject/${subject.id}`)}
                        isActive={location === `/subject/${subject.id}`}
                        data-testid={`button-subject-${subject.id}`}
                      >
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: subject.color ?? "#6366f1" }}
                        />
                        <span>{subject.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Ferramentas</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setLocation("/chat")}
                    isActive={location === "/chat"}
                    data-testid="button-ai-chat"
                  >
                    <Brain className="w-4 h-4" />
                    <span>AI Mentor</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => window.location.href = "/api/logout"}
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <Dialog open={isSubjectDialogOpen} onOpenChange={setIsSubjectDialogOpen}>
        <DialogContent data-testid="dialog-create-subject">
          <form onSubmit={handleCreateSubject}>
            <DialogHeader>
              <DialogTitle>Nova Disciplina</DialogTitle>
              <DialogDescription>
                Crie uma nova disciplina para organizar os seus tópicos de estudo.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="subject-name">Nome</Label>
                <Input
                  id="subject-name"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="Ex: Matemática"
                  data-testid="input-subject-name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subject-description">Descrição (opcional)</Label>
                <Textarea
                  id="subject-description"
                  value={newSubjectDescription}
                  onChange={(e) => setNewSubjectDescription(e.target.value)}
                  placeholder="Breve descrição..."
                  data-testid="input-subject-description"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subject-color">Cor</Label>
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
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!newSubjectName.trim() || createSubjectMutation.isPending}
                data-testid="button-submit-subject"
              >
                {createSubjectMutation.isPending ? "A criar..." : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
