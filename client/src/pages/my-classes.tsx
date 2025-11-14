import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Users, Copy, Trash2, UserMinus } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import type { User } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface Class {
  id: string;
  name: string;
  description: string | null;
  teacherId: string;
  inviteCode: string;
  isActive: boolean;
  createdAt: string;
}

interface Student {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  totalXp: number;
  currentLevel: string;
  enrolledAt: string;
}

export default function MyClasses() {
  const { toast } = useToast();
  const { user } = useAuth();
  const typedUser = user as User | null;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassDescription, setNewClassDescription] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const { data: classesData, isLoading: classesLoading } = useQuery<{ success: boolean; classes: Class[] }>({
    queryKey: ["/api/classes"],
  });

  const { data: studentsData, isLoading: studentsLoading } = useQuery<{ success: boolean; class: Class; students: Student[] }>({
    queryKey: ["/api/classes", selectedClassId],
    enabled: !!selectedClassId,
  });

  const createClassMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      return await apiRequest("POST", "/api/classes", data);
    },
    onSuccess: () => {
      toast({
        title: "Turma criada!",
        description: "A tua turma foi criada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setIsCreateDialogOpen(false);
      setNewClassName("");
      setNewClassDescription("");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar a turma.",
        variant: "destructive",
      });
    },
  });

  const deleteClassMutation = useMutation({
    mutationFn: async (classId: string) => {
      return await apiRequest("DELETE", `/api/classes/${classId}`);
    },
    onSuccess: () => {
      toast({
        title: "Turma eliminada",
        description: "A turma foi eliminada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setSelectedClassId(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível eliminar a turma.",
        variant: "destructive",
      });
    },
  });

  const removeStudentMutation = useMutation({
    mutationFn: async ({ classId, studentId }: { classId: string; studentId: string }) => {
      return await apiRequest("DELETE", `/api/classes/${classId}/students/${studentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Aluno removido",
        description: "O aluno foi removido da turma.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/classes", selectedClassId] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível remover o aluno.",
        variant: "destructive",
      });
    },
  });

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Código copiado!",
      description: "O código de convite foi copiado para a área de transferência.",
    });
  };

  const handleCreateClass = () => {
    if (!newClassName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, insere um nome para a turma.",
        variant: "destructive",
      });
      return;
    }
    createClassMutation.mutate({
      name: newClassName,
      description: newClassDescription,
    });
  };

  if (typedUser?.role !== "teacher") {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto py-8 px-4 max-w-7xl">
          <p className="text-muted-foreground">Esta página é apenas para professores.</p>
        </div>
      </div>
    );
  }

  const classes = classesData?.classes || [];
  const selectedClass = studentsData?.class;
  const students = studentsData?.students || [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="title-my-classes">
              As Minhas Turmas
            </h1>
            <p className="text-muted-foreground">
              Gere as tuas turmas e acompanha o progresso dos teus alunos
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-class">
                <Plus className="w-4 h-4 mr-2" />
                Nova Turma
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-create-class">
              <DialogHeader>
                <DialogTitle>Criar Nova Turma</DialogTitle>
                <DialogDescription>
                  Cria uma turma para organizar e acompanhar os teus alunos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="class-name">Nome da Turma</Label>
                  <Input
                    id="class-name"
                    data-testid="input-class-name"
                    placeholder="Ex: Matemática 10º A"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="class-description">Descrição (opcional)</Label>
                  <Textarea
                    id="class-description"
                    data-testid="input-class-description"
                    placeholder="Descrição da turma..."
                    value={newClassDescription}
                    onChange={(e) => setNewClassDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreateClass}
                  disabled={createClassMutation.isPending}
                  data-testid="button-submit-create-class"
                >
                  {createClassMutation.isPending ? "A criar..." : "Criar Turma"}
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
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Ainda não tens turmas</h3>
              <p className="text-muted-foreground mb-4">
                Cria a tua primeira turma para começar a acompanhar os teus alunos
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {classes.map((classItem) => (
              <Card
                key={classItem.id}
                className="hover-elevate cursor-pointer transition-all"
                onClick={() => setSelectedClassId(classItem.id)}
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
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {classItem.inviteCode}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyInviteCode(classItem.inviteCode);
                      }}
                      data-testid={`button-copy-code-${classItem.id}`}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Ver detalhes →</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {selectedClassId && (
          <Dialog open={!!selectedClassId} onOpenChange={() => setSelectedClassId(null)}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-class-details">
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-2xl" data-testid="text-selected-class-name">
                      {selectedClass?.name}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      {selectedClass?.description || "Sem descrição"}
                    </DialogDescription>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" data-testid="button-delete-class">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Tens a certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser revertida. Isto irá eliminar permanentemente a turma
                          e remover todos os alunos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteClassMutation.mutate(selectedClassId)}
                          data-testid="button-confirm-delete"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="flex items-center gap-2 p-4 border rounded-md">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">Código de Convite</Label>
                    <p className="font-mono text-lg mt-1" data-testid="text-invite-code">
                      {selectedClass?.inviteCode}
                    </p>
                  </div>
                  <Button
                    onClick={() => selectedClass && copyInviteCode(selectedClass.inviteCode)}
                    data-testid="button-copy-invite"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </Button>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    Alunos ({students.length})
                  </h3>
                  {studentsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 border rounded-md">
                          <Skeleton className="w-12 h-12 rounded-full" />
                          <div className="flex-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24 mt-2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : students.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <Users className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          Ainda não há alunos nesta turma
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {students.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center gap-3 p-3 border rounded-md hover-elevate"
                          data-testid={`student-item-${student.id}`}
                        >
                          <div className="flex-1">
                            <p className="font-medium" data-testid={`text-student-name-${student.id}`}>
                              {student.displayName || student.firstName || "Sem nome"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                Nível: {student.currentLevel}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {student.totalXp} XP
                              </Badge>
                            </div>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                data-testid={`button-remove-student-${student.id}`}
                              >
                                <UserMinus className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover aluno?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tens a certeza que queres remover este aluno da turma?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    removeStudentMutation.mutate({
                                      classId: selectedClassId,
                                      studentId: student.id,
                                    })
                                  }
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
