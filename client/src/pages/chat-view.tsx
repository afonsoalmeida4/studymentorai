import { useState, useRef, useEffect } from "react";
import { Send, Brain, Sparkles, Trash2, Plus, Lock, Pencil } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { translateError } from "@/lib/errorTranslation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import type { ChatThread, ChatMessage, Topic } from "@shared/schema";
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

type ChatMode = "study" | "existential";

interface ThreadWithMessages extends ChatThread {
  messages?: ChatMessage[];
}

export default function ChatView() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeMode, setActiveMode] = useState<ChatMode>("study");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<"uploads" | "chat" | "summaries" | "features">("chat");
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const { subscription, isLoading: isLoadingSubscription } = useSubscription();
  const subscriptionResolved = !isLoadingSubscription;
  const currentPlan = subscription?.plan || "free";
  const isExistentialLocked = currentPlan === "free";
  const canUsePremiumFeatures = currentPlan !== "free";

  const { data: studyThreads = [] } = useQuery<ChatThread[]>({
    queryKey: ["/api/chat/threads", "study"],
    queryFn: async () => {
      const res = await fetch("/api/chat/threads?mode=study");
      if (!res.ok) throw new Error("Failed to fetch study threads");
      const data = await res.json();
      return data.threads || [];
    },
    enabled: currentPlan !== "free",
  });

  const { data: existentialThreads = [] } = useQuery<ChatThread[]>({
    queryKey: ["/api/chat/threads", "existential"],
    queryFn: async () => {
      const res = await fetch("/api/chat/threads?mode=existential");
      if (!res.ok) throw new Error("Failed to fetch existential threads");
      const data = await res.json();
      return data.threads || [];
    },
    enabled: currentPlan !== "free",
  });

  const { data: topics = [] } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
    queryFn: async () => {
      const res = await fetch("/api/topics");
      if (!res.ok) throw new Error("Failed to fetch topics");
      const data = await res.json();
      return data.topics || [];
    },
    enabled: currentPlan !== "free",
  });

  const { data: currentThread } = useQuery<ThreadWithMessages>({
    queryKey: ["/api/chat/threads", selectedThreadId],
    queryFn: async () => {
      if (!selectedThreadId) throw new Error("No thread selected");
      const res = await fetch(`/api/chat/threads/${selectedThreadId}`);
      if (!res.ok) throw new Error("Failed to fetch thread");
      const data = await res.json();
      return data.thread;
    },
    enabled: !!selectedThreadId && currentPlan !== "free",
  });

  const createThreadMutation = useMutation({
    mutationFn: async (mode: ChatMode) => {
      return apiRequest("POST", "/api/chat/threads", {
        mode,
        topicId: mode === "study" ? selectedTopicId : null,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
      if (data.thread) {
        setSelectedThreadId(data.thread.id);
      }
      toast({
        title: "Nova conversa criada!",
        description: "Pode começar a conversar com o AI Mentor.",
      });
    },
    onError: (error: any) => {
      if (error.status === 403) {
        setUpgradeReason("features");
        setShowUpgradeDialog(true);
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: error.message || "Não foi possível criar a conversa.",
        });
      }
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/chat/messages", {
        threadId: selectedThreadId,
        message: content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/threads", selectedThreadId] });
      setMessageInput("");
    },
    onError: (error: any) => {
      if (error.status === 403) {
        setUpgradeReason("chat");
        setShowUpgradeDialog(true);
        
        // Show translated error message in toast
        const translatedError = translateError(t, {
          errorCode: error.errorCode,
          params: error.params,
          error: error.message
        });
        
        toast({
          variant: "destructive",
          title: t('common.error'),
          description: translatedError,
        });
      } else {
        toast({
          variant: "destructive",
          title: t('common.error'),
          description: error.message || t('errors.tryAgain'),
        });
      }
    },
  });

  const deleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      return apiRequest("DELETE", `/api/chat/threads/${threadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
      setSelectedThreadId(null);
      toast({
        title: "Conversa eliminada",
        description: "A conversa foi removida com sucesso.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível eliminar a conversa.",
      });
    },
  });

  const updateThreadTitleMutation = useMutation({
    mutationFn: async ({ threadId, title }: { threadId: string; title: string }) => {
      return apiRequest("PATCH", `/api/chat/threads/${threadId}`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/threads"] });
      setEditingThreadId(null);
      setEditingTitle("");
      toast({
        title: "Nome atualizado!",
        description: "O nome da conversa foi atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível atualizar o nome.",
      });
    },
  });

  useEffect(() => {
    if (subscriptionResolved && currentPlan === "free") {
      setLocation("/subscription");
    }
  }, [subscriptionResolved, currentPlan, setLocation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentThread?.messages]);

  if (!subscriptionResolved || currentPlan === "free") {
    return null;
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUsePremiumFeatures) {
      setUpgradeReason("chat");
      setShowUpgradeDialog(true);
      return;
    }
    if (messageInput.trim() && selectedThreadId) {
      sendMessageMutation.mutate(messageInput.trim());
    }
  };

  const handleStartNewThread = () => {
    if (!canUsePremiumFeatures) {
      setUpgradeReason("features");
      setShowUpgradeDialog(true);
      return;
    }
    if (activeMode === "existential" && isExistentialLocked) {
      setUpgradeReason("features");
      setShowUpgradeDialog(true);
      return;
    }
    if (activeMode === "study" && !selectedTopicId) {
      toast({
        variant: "destructive",
        title: t('chat.selectTopic'),
        description: t('chat.selectTopicDescription'),
      });
      return;
    }
    createThreadMutation.mutate(activeMode);
  };

  const handleModeChange = (newMode: string) => {
    if (newMode === "existential" && isExistentialLocked) {
      setUpgradeReason("features");
      setShowUpgradeDialog(true);
      return;
    }
    setActiveMode(newMode as ChatMode);
    setSelectedThreadId(null);
  };

  const handleDeleteThread = (threadId: string) => {
    if (!canUsePremiumFeatures) {
      setUpgradeReason("features");
      setShowUpgradeDialog(true);
      return;
    }
    deleteThreadMutation.mutate(threadId);
  };

  const handleStartEditTitle = (threadId: string, currentTitle: string) => {
    setEditingThreadId(threadId);
    setEditingTitle(currentTitle);
  };

  const handleSaveTitle = () => {
    if (!editingThreadId || !editingTitle.trim()) return;
    updateThreadTitleMutation.mutate({
      threadId: editingThreadId,
      title: editingTitle.trim(),
    });
  };

  const handleCancelEdit = () => {
    setEditingThreadId(null);
    setEditingTitle("");
  };

  const currentThreads = activeMode === "study" ? studyThreads : existentialThreads;

  return (
    <div className="flex h-full">
      <div className="w-64 border-r flex flex-col">
        <div className="p-4 border-b">
          <Tabs value={activeMode} onValueChange={handleModeChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="study" data-testid="tab-study-mode">
                <Brain className="w-4 h-4 mr-2" />
                {t('chat.studyMode')}
              </TabsTrigger>
              <TabsTrigger 
                value="existential" 
                data-testid="tab-existential-mode"
                disabled={isExistentialLocked}
              >
                {isExistentialLocked && <Lock className="w-3 h-3 mr-2" />}
                {!isExistentialLocked && <Sparkles className="w-4 h-4 mr-2" />}
                {t('chat.existentialMode')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {activeMode === "study" && (
          <div className="p-4 border-b">
            <Select value={selectedTopicId || ""} onValueChange={setSelectedTopicId}>
              <SelectTrigger data-testid="select-topic">
                <SelectValue placeholder="Selecione um tópico" />
              </SelectTrigger>
              <SelectContent>
                {topics.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="p-4">
          <Button
            onClick={handleStartNewThread}
            className="w-full"
            disabled={createThreadMutation.isPending}
            data-testid="button-new-chat"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Conversa
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {currentThreads.map((thread) => (
              <div
                key={thread.id}
                className={`group p-2 rounded hover-elevate cursor-pointer flex items-center gap-2 ${
                  selectedThreadId === thread.id ? "bg-accent" : ""
                }`}
                onClick={() => setSelectedThreadId(thread.id)}
                data-testid={`thread-item-${thread.id}`}
              >
                <span className="text-sm truncate flex-1">
                  {thread.title || "Nova conversa"}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEditTitle(thread.id, thread.title || "");
                    }}
                    data-testid={`button-edit-thread-${thread.id}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteThread(thread.id);
                    }}
                    data-testid={`button-delete-thread-${thread.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {!selectedThreadId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              {activeMode === "study" ? (
                <>
                  <Brain className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-2xl font-semibold mb-2">Study Mode</h2>
                  <p className="text-muted-foreground mb-4">
                    Tire dúvidas sobre os seus materiais de estudo. Selecione um tópico e comece
                    uma nova conversa.
                  </p>
                </>
              ) : (
                <>
                  <Sparkles className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-2xl font-semibold mb-2">Existential Mode</h2>
                  <p className="text-muted-foreground mb-4">
                    Converse sobre motivação, foco, ansiedade ou propósito. O AI Mentor está aqui
                    para apoiar.
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full" ref={scrollRef}>
                <div className="p-6 space-y-4">
                  {currentThread?.messages?.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      data-testid={`message-${message.id}`}
                    >
                      <Card
                        className={`max-w-[80%] ${
                          message.role === "user" ? "bg-primary text-primary-foreground" : ""
                        }`}
                      >
                        <CardContent className="p-3">
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                  {sendMessageMutation.isPending && (
                    <div className="flex justify-start">
                      <Card>
                        <CardContent className="p-3">
                          <p className="text-sm text-muted-foreground">A pensar...</p>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={
                    activeMode === "study"
                      ? "Faça uma pergunta sobre o conteúdo..."
                      : "Como te posso ajudar hoje?"
                  }
                  className="resize-none"
                  rows={2}
                  data-testid="input-message"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        )}
      </div>

      <Dialog open={!!editingThreadId} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Nome da Conversa</DialogTitle>
            <DialogDescription>
              Escolha um nome descritivo para esta conversa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="thread-title">Nome</Label>
              <Input
                id="thread-title"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                placeholder="Nome da conversa"
                data-testid="input-thread-title"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveTitle();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              data-testid="button-cancel-edit"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveTitle}
              disabled={!editingTitle.trim() || updateThreadTitleMutation.isPending}
              data-testid="button-save-title"
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        limitType={upgradeReason}
        currentPlan={currentPlan}
      />
    </div>
  );
}
