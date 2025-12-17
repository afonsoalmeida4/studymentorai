import { useState } from "react";
import { useParams } from "wouter";
import { Plus, Pencil, Trash2, BookOpen, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { translateError } from "@/lib/errorTranslation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import type { Subject, Topic } from "@shared/schema";

export default function SubjectView() {
  const params = useParams<{ id?: string }>();
  const subjectId = params.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isTopicDialogOpen, setIsTopicDialogOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicDescription, setNewTopicDescription] = useState("");
  const [topicToDelete, setTopicToDelete] = useState<Topic | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  
  // Edit states
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editSubjectDescription, setEditSubjectDescription] = useState("");
  const [topicToEdit, setTopicToEdit] = useState<Topic | null>(null);
  const [editTopicName, setEditTopicName] = useState("");
  const [editTopicDescription, setEditTopicDescription] = useState("");

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    select: (data: any) => data.subjects || [],
  });

  const { data: topics = [] } = useQuery<Topic[]>({
    queryKey: ["/api/topics", subjectId],
    queryFn: async () => {
      if (!subjectId) return [];
      const res = await fetch(`/api/topics?subjectId=${subjectId}`);
      if (!res.ok) throw new Error("Failed to fetch topics");
      const data = await res.json();
      return data.topics || [];
    },
    enabled: !!subjectId,
  });

  const { data: topicProgressData = [] } = useQuery<Array<{ topicId: string; completed: boolean }>>({
    queryKey: ["/api/topic-progress"],
    queryFn: async () => {
      const res = await fetch("/api/topic-progress");
      if (!res.ok) return [];
      const data = await res.json();
      return data.progress || [];
    },
    enabled: !!subjectId,
  });

  const currentSubject = subjects.find((s) => s.id === subjectId);

  const toggleTopicCompletionMutation = useMutation({
    mutationFn: async (topicId: string) => {
      return apiRequest("POST", `/api/topic-progress/${topicId}/toggle`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topic-progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/subject-progress"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('subjectView.errorTogglingProgress'),
      });
    },
  });

  const handleToggleComplete = (e: React.MouseEvent, topicId: string) => {
    e.stopPropagation();
    toggleTopicCompletionMutation.mutate(topicId);
  };

  const isTopicCompleted = (topicId: string) => {
    return topicProgressData.some(p => p.topicId === topicId && p.completed);
  };

  const createTopicMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/topics", {
        subjectId,
        name: newTopicName,
        description: newTopicDescription,
        position: topics.length,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", subjectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/subject-progress"] });
      setIsTopicDialogOpen(false);
      setNewTopicName("");
      setNewTopicDescription("");
      toast({
        title: t('subjectView.topicCreated'),
        description: t('subjectView.topicCreatedDescription'),
      });
    },
    onError: (error: any) => {
      // Translate error message using errorCode if available (data comes from apiRequest)
      const translatedError = translateError(t, {
        errorCode: error?.data?.errorCode,
        params: error?.data?.params,
        error: error?.message
      });
      
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: translatedError || t('subjectView.errorCreatingTopic'),
      });
    },
  });

  const handleCreateTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTopicName.trim()) {
      createTopicMutation.mutate();
    }
  };

  const deleteTopicMutation = useMutation({
    mutationFn: async (topicId: string) => {
      return apiRequest("DELETE", `/api/topics/${topicId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", subjectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/subject-progress"] });
      setTopicToDelete(null);
      toast({
        title: t('subjectView.topicDeleted'),
        description: t('subjectView.topicDeletedDescription'),
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('subjectView.errorDeletingTopic'),
      });
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: async (subjectId: string) => {
      return apiRequest("DELETE", `/api/subjects/${subjectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/subject-progress"] });
      setSubjectToDelete(null);
      setLocation("/subjects");
      toast({
        title: t('subjectView.subjectDeleted'),
        description: t('subjectView.subjectDeletedDescription'),
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('subjectView.errorDeletingSubject'),
      });
    },
  });

  const handleDeleteTopic = (e: React.MouseEvent, topic: Topic) => {
    e.stopPropagation();
    e.preventDefault();
    setTopicToDelete(topic);
  };

  const handleDeleteSubject = (e: React.MouseEvent, subject: Subject) => {
    e.stopPropagation();
    e.preventDefault();
    setSubjectToDelete(subject);
  };

  // Edit mutations
  const editSubjectMutation = useMutation({
    mutationFn: async () => {
      if (!subjectToEdit) return;
      return apiRequest("PATCH", `/api/subjects/${subjectToEdit.id}`, {
        name: editSubjectName,
        description: editSubjectDescription || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      setSubjectToEdit(null);
      toast({
        title: t('subjectView.subjectUpdated'),
        description: t('subjectView.subjectUpdatedDescription'),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('subjectView.errorUpdatingSubject'),
      });
    },
  });

  const editTopicMutation = useMutation({
    mutationFn: async () => {
      if (!topicToEdit) return;
      return apiRequest("PATCH", `/api/topics/${topicToEdit.id}`, {
        name: editTopicName,
        description: editTopicDescription || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", subjectId] });
      setTopicToEdit(null);
      toast({
        title: t('subjectView.topicUpdated'),
        description: t('subjectView.topicUpdatedDescription'),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('subjectView.errorUpdatingTopic'),
      });
    },
  });

  const handleEditSubject = (e: React.MouseEvent, subject: Subject) => {
    e.stopPropagation();
    e.preventDefault();
    setSubjectToEdit(subject);
    setEditSubjectName(subject.name);
    setEditSubjectDescription(subject.description || "");
  };

  const handleEditTopic = (e: React.MouseEvent, topic: Topic) => {
    e.stopPropagation();
    e.preventDefault();
    setTopicToEdit(topic);
    setEditTopicName(topic.name);
    setEditTopicDescription(topic.description || "");
  };

  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (editSubjectName.trim()) {
      editSubjectMutation.mutate();
    }
  };

  const handleSaveTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (editTopicName.trim()) {
      editTopicMutation.mutate();
    }
  };

  if (!subjectId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">{t('subjectView.welcome')}</h1>
          <p className="text-muted-foreground">
            {t('subjectView.selectSubject')}
          </p>
        </div>

        {subjects.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">{t('subjectView.noSubjects')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('subjectView.createFirstSubject')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('subjectView.clickPlus')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {subjects.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <Card
                key={subject.id}
                className="hover-elevate active-elevate-2"
                data-testid={`card-subject-${subject.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div 
                      className="flex items-center gap-3 mb-2 flex-1 cursor-pointer"
                      onClick={() => setLocation(`/subject/${subject.id}`)}
                    >
                      <div
                        className="w-4 h-4 rounded flex-shrink-0"
                        style={{ backgroundColor: subject.color ?? "#6366f1" }}
                      />
                      <CardTitle className="text-lg">{subject.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => handleEditSubject(e, subject)}
                        data-testid={`button-edit-subject-${subject.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setSubjectToDelete(subject)}
                        data-testid={`button-delete-subject-${subject.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {subject.description && (
                    <CardDescription 
                      className="cursor-pointer"
                      onClick={() => setLocation(`/subject/${subject.id}`)}
                    >
                      {subject.description}
                    </CardDescription>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {/* Delete subject confirmation dialog */}
        <AlertDialog open={!!subjectToDelete} onOpenChange={(open) => !open && setSubjectToDelete(null)}>
          <AlertDialogContent data-testid="dialog-delete-subject-list">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('subjectView.deleteSubjectTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('subjectView.deleteSubjectDescription', { name: subjectToDelete?.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-subject-list">
                {t('common.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => subjectToDelete && deleteSubjectMutation.mutate(subjectToDelete.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-subject-list"
              >
                {deleteSubjectMutation.isPending ? t('common.deleting') : t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit subject dialog */}
        <Dialog open={!!subjectToEdit} onOpenChange={(open) => !open && setSubjectToEdit(null)}>
          <DialogContent data-testid="dialog-edit-subject-list">
            <form onSubmit={handleSaveSubject}>
              <DialogHeader>
                <DialogTitle>{t('subjectView.editSubject')}</DialogTitle>
                <DialogDescription>
                  {t('subjectView.editSubjectDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-subject-name-list">{t('subjectView.name')}</Label>
                  <Input
                    id="edit-subject-name-list"
                    value={editSubjectName}
                    onChange={(e) => setEditSubjectName(e.target.value)}
                    placeholder={t('subjectView.namePlaceholder')}
                    data-testid="input-edit-subject-name-list"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-subject-description-list">{t('subjectView.descriptionOptional')}</Label>
                  <Textarea
                    id="edit-subject-description-list"
                    value={editSubjectDescription}
                    onChange={(e) => setEditSubjectDescription(e.target.value)}
                    placeholder={t('subjectView.descriptionPlaceholder')}
                    data-testid="input-edit-subject-description-list"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSubjectToEdit(null)}
                  data-testid="button-cancel-edit-subject-list"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={!editSubjectName.trim() || editSubjectMutation.isPending}
                  data-testid="button-save-subject-list"
                >
                  {editSubjectMutation.isPending ? t('common.saving') : t('common.save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <>
      <div className="p-2 sm:p-4 md:p-6 w-full max-w-7xl mx-auto overflow-x-hidden min-w-0">
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="relative flex-shrink-0">
              <div 
                className="absolute inset-0 blur-md opacity-50 rounded-xl"
                style={{ backgroundColor: currentSubject?.color ?? "#6366f1" }}
              />
              <div
                className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: currentSubject?.color ?? "#6366f1" }}
              >
                <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold truncate">{currentSubject?.name || t('subjectView.subject')}</h1>
              {currentSubject?.description && (
                <p className="text-sm text-muted-foreground line-clamp-1">{currentSubject.description}</p>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div 
          className="flex items-center justify-between mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h2 className="text-xl font-medium">{t('subjectView.topics')}</h2>
          <Button
            onClick={() => setIsTopicDialogOpen(true)}
            className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg shadow-primary/25"
            data-testid="button-add-topic"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('subjectView.newTopic')}
          </Button>
        </motion.div>

        {topics.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <div className="relative mx-auto w-fit mb-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary to-violet-600 blur-md opacity-30 rounded-2xl" />
                    <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 border border-primary/20">
                      <BookOpen className="w-10 h-10 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{t('subjectView.noTopics')}</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                    {t('subjectView.createTopicsDescription')}
                  </p>
                  <Button
                    onClick={() => setIsTopicDialogOpen(true)}
                    className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg shadow-primary/25"
                    data-testid="button-create-first-topic"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('subjectView.createFirstTopic')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div 
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {topics.map((topic, index) => {
              const completed = isTopicCompleted(topic.id);
              return (
                <motion.div
                  key={topic.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
                >
                  <Card
                    className="relative overflow-hidden hover:shadow-lg cursor-pointer transition-all duration-300 hover:-translate-y-0.5 group"
                    onClick={() => setLocation(`/topic/${topic.id}`)}
                    data-testid={`card-topic-${topic.id}`}
                  >
                    <div 
                      className="absolute inset-0 opacity-5"
                      style={{ backgroundColor: currentSubject?.color ?? "#6366f1" }}
                    />
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
                      style={{ backgroundColor: currentSubject?.color ?? "#6366f1" }}
                    />
                    <CardHeader className="relative">
                      <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{topic.name}</CardTitle>
                        {topic.description && (
                          <CardDescription>{topic.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => handleToggleComplete(e, topic.id)}
                          className="p-1 rounded-full hover-elevate active-elevate-2 transition-colors"
                          data-testid={`checkbox-topic-${topic.id}`}
                          aria-label={completed ? t('subjectView.markIncomplete') : t('subjectView.markComplete')}
                        >
                          {completed ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground" />
                          )}
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={(e) => handleEditTopic(e, topic)}
                          data-testid={`button-edit-topic-${topic.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => handleDeleteTopic(e, topic)}
                          data-testid={`button-delete-topic-${topic.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      <Dialog open={isTopicDialogOpen} onOpenChange={setIsTopicDialogOpen}>
        <DialogContent data-testid="dialog-create-topic">
          <form onSubmit={handleCreateTopic}>
            <DialogHeader>
              <DialogTitle>{t('subjectView.newTopic')}</DialogTitle>
              <DialogDescription>
                {t('subjectView.createTopicIn', { subject: currentSubject?.name })}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="topic-name">{t('subjectView.name')}</Label>
                <Input
                  id="topic-name"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  placeholder={t('subjectView.namePlaceholder')}
                  data-testid="input-topic-name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="topic-description">{t('subjectView.descriptionOptional')}</Label>
                <Textarea
                  id="topic-description"
                  value={newTopicDescription}
                  onChange={(e) => setNewTopicDescription(e.target.value)}
                  placeholder={t('subjectView.descriptionPlaceholder')}
                  data-testid="input-topic-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTopicDialogOpen(false)}
                data-testid="button-cancel-topic"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!newTopicName.trim() || createTopicMutation.isPending}
                data-testid="button-submit-topic"
              >
                {createTopicMutation.isPending ? t('subjectView.creating') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!topicToDelete} onOpenChange={(open) => !open && setTopicToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-topic">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('subjectView.deleteTopicTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('subjectView.deleteTopicDescription', { name: topicToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-topic">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => topicToDelete && deleteTopicMutation.mutate(topicToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-topic"
            >
              {deleteTopicMutation.isPending ? t('common.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!subjectToDelete} onOpenChange={(open) => !open && setSubjectToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-subject">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('subjectView.deleteSubjectTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('subjectView.deleteSubjectDescription', { name: subjectToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-subject">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => subjectToDelete && deleteSubjectMutation.mutate(subjectToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-subject"
            >
              {deleteSubjectMutation.isPending ? t('common.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit subject dialog */}
      <Dialog open={!!subjectToEdit} onOpenChange={(open) => !open && setSubjectToEdit(null)}>
        <DialogContent data-testid="dialog-edit-subject">
          <form onSubmit={handleSaveSubject}>
            <DialogHeader>
              <DialogTitle>{t('subjectView.editSubject')}</DialogTitle>
              <DialogDescription>
                {t('subjectView.editSubjectDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-subject-name">{t('subjectView.name')}</Label>
                <Input
                  id="edit-subject-name"
                  value={editSubjectName}
                  onChange={(e) => setEditSubjectName(e.target.value)}
                  placeholder={t('subjectView.namePlaceholder')}
                  data-testid="input-edit-subject-name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-subject-description">{t('subjectView.descriptionOptional')}</Label>
                <Textarea
                  id="edit-subject-description"
                  value={editSubjectDescription}
                  onChange={(e) => setEditSubjectDescription(e.target.value)}
                  placeholder={t('subjectView.descriptionPlaceholder')}
                  data-testid="input-edit-subject-description"
                />
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
                data-testid="button-save-subject"
              >
                {editSubjectMutation.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit topic dialog */}
      <Dialog open={!!topicToEdit} onOpenChange={(open) => !open && setTopicToEdit(null)}>
        <DialogContent data-testid="dialog-edit-topic">
          <form onSubmit={handleSaveTopic}>
            <DialogHeader>
              <DialogTitle>{t('subjectView.editTopic')}</DialogTitle>
              <DialogDescription>
                {t('subjectView.editTopicDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-topic-name">{t('subjectView.name')}</Label>
                <Input
                  id="edit-topic-name"
                  value={editTopicName}
                  onChange={(e) => setEditTopicName(e.target.value)}
                  placeholder={t('subjectView.namePlaceholder')}
                  data-testid="input-edit-topic-name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-topic-description">{t('subjectView.descriptionOptional')}</Label>
                <Textarea
                  id="edit-topic-description"
                  value={editTopicDescription}
                  onChange={(e) => setEditTopicDescription(e.target.value)}
                  placeholder={t('subjectView.descriptionPlaceholder')}
                  data-testid="input-edit-topic-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTopicToEdit(null)}
                data-testid="button-cancel-edit-topic"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!editTopicName.trim() || editTopicMutation.isPending}
                data-testid="button-save-topic"
              >
                {editTopicMutation.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
