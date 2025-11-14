import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Users, LogOut, GraduationCap } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import type { User } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface ClassEnrollment {
  id: string;
  name: string;
  description: string | null;
  teacherId: string;
  isActive: boolean;
  enrolledAt: string;
}

export default function StudentClasses() {
  const { toast } = useToast();
  const { user } = useAuth();
  const typedUser = user as User | null;
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  const { data: classesData, isLoading: classesLoading } = useQuery<{ success: boolean; classes: ClassEnrollment[] }>({
    queryKey: ["/api/classes"],
  });

  const joinClassMutation = useMutation({
    mutationFn: async (code: string) => {
      return await apiRequest("POST", "/api/classes/join", { inviteCode: code });
    },
    onSuccess: () => {
      toast({
        title: "Entrou na turma!",
        description: "Foste adicionado à turma com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setIsJoinDialogOpen(false);
      setInviteCode("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível juntar-se à turma.",
        variant: "destructive",
      });
    },
  });

  const leaveClassMutation = useMutation({
    mutationFn: async (classId: string) => {
      return await apiRequest("POST", `/api/classes/${classId}/leave`);
    },
    onSuccess: () => {
      toast({
        title: "Saíste da turma",
        description: "Foste removido da turma com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível sair da turma.",
        variant: "destructive",
      });
    },
  });

  const handleJoinClass = () => {
    const trimmedCode = inviteCode.trim();
    if (!trimmedCode) {
      toast({
        title: "Código obrigatório",
        description: "Por favor, insere um código de convite.",
        variant: "destructive",
      });
      return;
    }
    if (trimmedCode.length !== 8) {
      toast({
        title: "Código inválido",
        description: "O código de convite deve ter 8 caracteres.",
        variant: "destructive",
      });
      return;
    }
    joinClassMutation.mutate(trimmedCode);
  };

  if (typedUser?.role !== "student") {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto py-8 px-4 max-w-7xl">
          <p className="text-muted-foreground">Esta página é apenas para alunos.</p>
        </div>
      </div>
    );
  }

  const classes = classesData?.classes || [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="title-student-classes">
              As Minhas Turmas
            </h1>
            <p className="text-muted-foreground">
              Turmas em que estás inscrito
            </p>
          </div>
          <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-join-class">
                <Plus className="w-4 h-4 mr-2" />
                Juntar a Turma
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-join-class">
              <DialogHeader>
                <DialogTitle>Juntar-se a uma Turma</DialogTitle>
                <DialogDescription>
                  Insere o código de convite fornecido pelo teu professor
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-code">Código de Convite</Label>
                  <Input
                    id="invite-code"
                    data-testid="input-invite-code"
                    placeholder="Ex: ABC12345"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    maxLength={8}
                    className="font-mono tracking-wider"
                  />
                  <p className="text-xs text-muted-foreground">
                    O código tem 8 caracteres
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleJoinClass}
                  disabled={joinClassMutation.isPending}
                  data-testid="button-submit-join-class"
                >
                  {joinClassMutation.isPending ? "A juntar..." : "Juntar-me"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {classesLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : classes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <GraduationCap className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Ainda não estás em nenhuma turma</h3>
              <p className="text-muted-foreground mb-4">
                Pede ao teu professor o código de convite para te juntares a uma turma
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {classes.map((classItem) => (
              <Card
                key={classItem.id}
                className="hover-elevate transition-all"
                data-testid={`card-class-${classItem.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl" data-testid={`text-class-name-${classItem.id}`}>
                        {classItem.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {classItem.description || "Sem descrição"}
                      </CardDescription>
                    </div>
                    {classItem.isActive && (
                      <Badge variant="secondary" data-testid={`badge-active-${classItem.id}`}>
                        Ativa
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>
                      Inscrito desde {new Date(classItem.enrolledAt).toLocaleDateString('pt-PT', { 
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        data-testid={`button-leave-class-${classItem.id}`}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sair da Turma
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Tens a certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Vais sair da turma "{classItem.name}". Terás de pedir um novo código de
                          convite ao professor para voltares a entrar.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => leaveClassMutation.mutate(classItem.id)}
                          data-testid={`button-confirm-leave-${classItem.id}`}
                        >
                          Sair
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
