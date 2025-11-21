import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit, Trash2, CreditCard, Sparkles, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import type { Flashcard, Subject, Topic } from "@shared/schema";

type FlashcardWithMetadata = Flashcard & {
  subjectName?: string;
  topicName?: string;
};

export default function FlashcardsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [selectedFlashcard, setSelectedFlashcard] = useState<Flashcard | null>(null);
  
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("");
  const [filterTopic, setFilterTopic] = useState<string>("");
  
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    subjectId: "",
    topicId: "",
    language: (user as any)?.language || "pt",
  });

  const hasProOrPremium = subscription?.plan === "pro" || subscription?.plan === "premium";

  // Fetch all user flashcards
  const { data: flashcardsData, isLoading: isLoadingFlashcards } = useQuery<{ success: boolean; flashcards: Flashcard[] }>({
    queryKey: ["/api/flashcards/user", filterType, filterSubject, filterTopic],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterType === "manual") params.set("isManual", "true");
      if (filterType === "auto") params.set("isManual", "false");
      if (filterSubject && filterSubject !== "_all") params.set("subjectId", filterSubject);
      if (filterTopic && filterTopic !== "_all") params.set("topicId", filterTopic);
      
      const response = await fetch(`/api/flashcards/user?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch flashcards");
      return response.json();
    },
    enabled: hasProOrPremium,
  });

  // Fetch subjects for filter
  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    select: (data: any) => data.subjects || [],
  });

  // Fetch topics for filter (based on selected subject)
  const { data: topics = [] } = useQuery<Topic[]>({
    queryKey: ["/api/topics", filterSubject],
    queryFn: async () => {
      if (!filterSubject || filterSubject === "_all") return [];
      const response = await fetch(`/api/subjects/${filterSubject}/topics`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch topics");
      const data = await response.json();
      return data.topics || [];
    },
    enabled: !!filterSubject && filterSubject !== "_all",
  });

  // Fetch topics for form (based on selected subject in form or selected flashcard)
  const formSubjectId = formData.subjectId || selectedFlashcard?.subjectId || "";
  const { data: formTopics = [] } = useQuery<Topic[]>({
    queryKey: ["/api/topics/form", formSubjectId],
    queryFn: async () => {
      if (!formSubjectId || formSubjectId === "_none") return [];
      const response = await fetch(`/api/subjects/${formSubjectId}/topics`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch topics");
      const data = await response.json();
      return data.topics || [];
    },
    enabled: !!formSubjectId && formSubjectId !== "_none",
  });

  const flashcards = flashcardsData?.flashcards || [];

  // Create flashcard mutation
  const createFlashcardMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/flashcards/manual", {
        question: data.question,
        answer: data.answer,
        language: data.language,
        subjectId: (data.subjectId && data.subjectId !== "_none") ? data.subjectId : null,
        topicId: (data.topicId && data.topicId !== "_none") ? data.topicId : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/user"] });
      setShowCreateDialog(false);
      setFormData({ question: "", answer: "", subjectId: "", topicId: "", language: (user as any)?.language || "pt" });
      toast({
        title: t('flashcards.createSuccess'),
        description: t('flashcards.createSuccessMessage'),
      });
    },
    onError: (error: any) => {
      if (error?.errorCode === "MANUAL_FLASHCARD_NOT_AVAILABLE") {
        setShowCreateDialog(false);
        setShowUpgradeDialog(true);
      } else {
        toast({
          variant: "destructive",
          title: t('common.error'),
          description: error?.message || t('flashcards.createError'),
        });
      }
    },
  });

  // Update flashcard mutation
  const updateFlashcardMutation = useMutation({
    mutationFn: async ({ id, question, answer }: { id: string; question: string; answer: string }) => {
      return await apiRequest("PATCH", `/api/flashcards/${id}`, { question, answer });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/user"] });
      setShowEditDialog(false);
      setSelectedFlashcard(null);
      toast({
        title: t('flashcards.updateSuccess'),
        description: t('flashcards.updateSuccessMessage'),
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error?.message || t('flashcards.updateError'),
      });
    },
  });

  // Delete flashcard mutation
  const deleteFlashcardMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/flashcards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flashcards/user"] });
      setShowDeleteDialog(false);
      setSelectedFlashcard(null);
      toast({
        title: t('flashcards.deleteSuccess'),
        description: t('flashcards.deleteSuccessMessage'),
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error?.message || t('flashcards.deleteError'),
      });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasProOrPremium) {
      setShowUpgradeDialog(true);
      return;
    }
    createFlashcardMutation.mutate(formData);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFlashcard) return;
    updateFlashcardMutation.mutate({
      id: selectedFlashcard.id,
      question: formData.question,
      answer: formData.answer,
    });
  };

  const handleDelete = () => {
    if (!selectedFlashcard) return;
    deleteFlashcardMutation.mutate(selectedFlashcard.id);
  };

  const openEditDialog = (flashcard: Flashcard) => {
    setSelectedFlashcard(flashcard);
    setFormData({
      question: flashcard.question,
      answer: flashcard.answer,
      subjectId: flashcard.subjectId || "",
      topicId: flashcard.topicId || "",
      language: flashcard.language,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (flashcard: Flashcard) => {
    setSelectedFlashcard(flashcard);
    setShowDeleteDialog(true);
  };

  if (!hasProOrPremium) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t('flashcards.title')}
            </CardTitle>
            <CardDescription>
              {t('flashcards.upgradeRequired')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('flashcards.upgradeMessage')}
            </p>
            <Button onClick={() => setShowUpgradeDialog(true)} className="w-full">
              {t('common.upgradeToPro')}
            </Button>
          </CardContent>
        </Card>
        <UpgradeDialog
          open={showUpgradeDialog}
          onOpenChange={setShowUpgradeDialog}
          limitType="features"
          currentPlan={subscription?.plan || "free"}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            {t('flashcards.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('flashcards.description')}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-flashcard">
          <Plus className="h-4 w-4 mr-2" />
          {t('flashcards.createButton')}
        </Button>
      </div>

      {/* Filters */}
      <div className="border-b p-4">
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40" data-testid="select-filter-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('flashcards.filterAll')}</SelectItem>
              <SelectItem value="manual">{t('flashcards.filterManual')}</SelectItem>
              <SelectItem value="auto">{t('flashcards.filterAuto')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterSubject} onValueChange={(value) => {
            setFilterSubject(value);
            setFilterTopic("");
          }}>
            <SelectTrigger className="w-48" data-testid="select-filter-subject">
              <SelectValue placeholder={t('flashcards.filterBySubject')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t('flashcards.allSubjects')}</SelectItem>
              {subjects.map(subject => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {filterSubject && filterSubject !== "_all" && (
            <Select value={filterTopic} onValueChange={setFilterTopic}>
              <SelectTrigger className="w-48" data-testid="select-filter-topic">
                <SelectValue placeholder={t('flashcards.filterByTopic')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">{t('flashcards.allTopics')}</SelectItem>
                {topics.map(topic => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Flashcards List */}
      <div className="flex-1 overflow-auto p-4">
        {isLoadingFlashcards ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : flashcards.length === 0 ? (
          <Card className="max-w-md mx-auto mt-8">
            <CardHeader>
              <CardTitle>{t('flashcards.noFlashcardsTitle')}</CardTitle>
              <CardDescription>
                {t('flashcards.noFlashcardsMessage')}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {flashcards.map((flashcard) => (
              <Card key={flashcard.id} className="hover-elevate" data-testid={`card-flashcard-${flashcard.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2">
                      {flashcard.question}
                    </CardTitle>
                    <Badge variant={flashcard.isManual ? "default" : "secondary"} className="shrink-0">
                      {flashcard.isManual ? (
                        <>{t('flashcards.manual')}</>
                      ) : (
                        <><Sparkles className="h-3 w-3 mr-1" />{t('flashcards.auto')}</>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {flashcard.answer}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(flashcard)}
                        data-testid={`button-edit-${flashcard.id}`}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openDeleteDialog(flashcard)}
                        data-testid={`button-delete-${flashcard.id}`}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        {t('common.delete')}
                      </Button>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {flashcard.language.toUpperCase()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent data-testid="dialog-create-flashcard">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>{t('flashcards.createDialogTitle')}</DialogTitle>
              <DialogDescription>
                {t('flashcards.createDialogDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="question">{t('flashcards.question')}</Label>
                <Textarea
                  id="question"
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  placeholder={t('flashcards.questionPlaceholder')}
                  required
                  rows={3}
                  data-testid="input-question"
                />
              </div>
              <div>
                <Label htmlFor="answer">{t('flashcards.answer')}</Label>
                <Textarea
                  id="answer"
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  placeholder={t('flashcards.answerPlaceholder')}
                  required
                  rows={4}
                  data-testid="input-answer"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="subject">{t('flashcards.subject')} ({t('common.optional')})</Label>
                  <Select value={formData.subjectId} onValueChange={(value) => setFormData({ ...formData, subjectId: value, topicId: "" })}>
                    <SelectTrigger id="subject" data-testid="select-subject">
                      <SelectValue placeholder={t('flashcards.selectSubject')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{t('common.none')}</SelectItem>
                      {subjects.map(subject => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.subjectId && formData.subjectId !== "_none" && (
                  <div>
                    <Label htmlFor="topic">{t('flashcards.topic')} ({t('common.optional')})</Label>
                    <Select value={formData.topicId} onValueChange={(value) => setFormData({ ...formData, topicId: value })}>
                      <SelectTrigger id="topic" data-testid="select-topic">
                        <SelectValue placeholder={t('flashcards.selectTopic')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">{t('common.none')}</SelectItem>
                        {formTopics.map(topic => (
                          <SelectItem key={topic.id} value={topic.id}>
                            {topic.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createFlashcardMutation.isPending} data-testid="button-submit-create">
                {createFlashcardMutation.isPending ? t('common.creating') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent data-testid="dialog-edit-flashcard">
          <form onSubmit={handleEdit}>
            <DialogHeader>
              <DialogTitle>{t('flashcards.editDialogTitle')}</DialogTitle>
              <DialogDescription>
                {t('flashcards.editDialogDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-question">{t('flashcards.question')}</Label>
                <Textarea
                  id="edit-question"
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  required
                  rows={3}
                  data-testid="input-edit-question"
                />
              </div>
              <div>
                <Label htmlFor="edit-answer">{t('flashcards.answer')}</Label>
                <Textarea
                  id="edit-answer"
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  required
                  rows={4}
                  data-testid="input-edit-answer"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={updateFlashcardMutation.isPending} data-testid="button-submit-edit">
                {updateFlashcardMutation.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent data-testid="dialog-delete-flashcard">
          <DialogHeader>
            <DialogTitle>{t('flashcards.deleteDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('flashcards.deleteDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteFlashcardMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteFlashcardMutation.isPending ? t('common.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        limitType="features"
        currentPlan={subscription?.plan || "free"}
      />
    </div>
  );
}
