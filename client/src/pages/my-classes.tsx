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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
        title: t("myClasses.toasts.classCreated"),
        description: t("myClasses.toasts.classCreatedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setIsCreateDialogOpen(false);
      setNewClassName("");
      setNewClassDescription("");
    },
    onError: () => {
      toast({
        title: t("myClasses.toasts.error"),
        description: t("myClasses.toasts.createClassError"),
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
        title: t("myClasses.toasts.classDeleted"),
        description: t("myClasses.toasts.classDeletedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setSelectedClassId(null);
    },
    onError: () => {
      toast({
        title: t("myClasses.toasts.error"),
        description: t("myClasses.toasts.deleteClassError"),
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
        title: t("myClasses.toasts.studentRemoved"),
        description: t("myClasses.toasts.studentRemovedDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/classes", selectedClassId] });
    },
    onError: () => {
      toast({
        title: t("myClasses.toasts.error"),
        description: t("myClasses.toasts.removeStudentError"),
        variant: "destructive",
      });
    },
  });

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: t("myClasses.toasts.codeCopied"),
      description: t("myClasses.toasts.codeCopiedDescription"),
    });
  };

  const handleCreateClass = () => {
    if (!newClassName.trim()) {
      toast({
        title: t("myClasses.toasts.nameRequired"),
        description: t("myClasses.toasts.nameRequiredDescription"),
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
          <p className="text-muted-foreground">{t("myClasses.messages.teachersOnly")}</p>
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
              {t("myClasses.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("myClasses.subtitle")}
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-class">
                <Plus className="w-4 h-4 mr-2" />
                {t("myClasses.buttons.newClass")}
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-create-class">
              <DialogHeader>
                <DialogTitle>{t("myClasses.dialogs.createClass.title")}</DialogTitle>
                <DialogDescription>
                  {t("myClasses.dialogs.createClass.description")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="class-name">{t("myClasses.labels.className")}</Label>
                  <Input
                    id="class-name"
                    data-testid="input-class-name"
                    placeholder={t("myClasses.placeholders.className")}
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="class-description">{t("myClasses.labels.description")}</Label>
                  <Textarea
                    id="class-description"
                    data-testid="input-class-description"
                    placeholder={t("myClasses.placeholders.description")}
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
                  {createClassMutation.isPending ? t("myClasses.buttons.creating") : t("myClasses.buttons.createClass")}
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
              <h3 className="text-lg font-semibold mb-2">{t("myClasses.empty.noClasses")}</h3>
              <p className="text-muted-foreground mb-4">
                {t("myClasses.empty.noClassesDescription")}
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
                        {classItem.description || t("myClasses.messages.noDescription")}
                      </CardDescription>
                    </div>
                    {classItem.isActive && (
                      <Badge variant="secondary" data-testid={`badge-active-${classItem.id}`}>
                        {t("myClasses.status.active")}
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
                    <span>{t("myClasses.buttons.viewDetails")}</span>
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
                      {selectedClass?.description || t("myClasses.messages.noDescription")}
                    </DialogDescription>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" data-testid="button-delete-class">
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t("myClasses.buttons.delete")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("myClasses.dialogs.deleteClass.title")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("myClasses.dialogs.deleteClass.description")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-delete">{t("myClasses.buttons.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteClassMutation.mutate(selectedClassId)}
                          data-testid="button-confirm-delete"
                        >
                          {t("myClasses.buttons.delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="flex items-center gap-2 p-4 border rounded-md">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">{t("myClasses.labels.inviteCode")}</Label>
                    <p className="font-mono text-lg mt-1" data-testid="text-invite-code">
                      {selectedClass?.inviteCode}
                    </p>
                  </div>
                  <Button
                    onClick={() => selectedClass && copyInviteCode(selectedClass.inviteCode)}
                    data-testid="button-copy-invite"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {t("myClasses.buttons.copy")}
                  </Button>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    {t("myClasses.labels.students", { count: students.length })}
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
                          {t("myClasses.empty.noStudents")}
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
                              {student.displayName || student.firstName || t("myClasses.messages.noName")}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {t("myClasses.labels.level")}: {student.currentLevel}
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
                                <AlertDialogTitle>{t("myClasses.dialogs.removeStudent.title")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("myClasses.dialogs.removeStudent.description")}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("myClasses.buttons.cancel")}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    removeStudentMutation.mutate({
                                      classId: selectedClassId,
                                      studentId: student.id,
                                    })
                                  }
                                >
                                  {t("myClasses.buttons.remove")}
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
