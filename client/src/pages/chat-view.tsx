import { useState, useRef, useEffect } from "react";
import { Send, Brain, Sparkles, Trash2, Plus } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import type { ChatThread, ChatMessage, Topic } from "@shared/schema";

type ChatMode = "study" | "existential";

interface ThreadWithMessages extends ChatThread {
  messages?: ChatMessage[];
}

export default function ChatView() {
  const { toast } = useToast();
  const [activeMode, setActiveMode] = useState<ChatMode>("study");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: studyThreads = [] } = useQuery<ChatThread[]>({
    queryKey: ["/api/chat/threads", "study"],
    queryFn: async () => {
      const res = await fetch("/api/chat/threads?mode=study");
      if (!res.ok) throw new Error("Failed to fetch study threads");
      const data = await res.json();
      return data.threads || [];
    },
  });

  const { data: existentialThreads = [] } = useQuery<ChatThread[]>({
    queryKey: ["/api/chat/threads", "existential"],
    queryFn: async () => {
      const res = await fetch("/api/chat/threads?mode=existential");
      if (!res.ok) throw new Error("Failed to fetch existential threads");
      const data = await res.json();
      return data.threads || [];
    },
  });

  const { data: topics = [] } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
    queryFn: async () => {
      const res = await fetch("/api/topics");
      if (!res.ok) throw new Error("Failed to fetch topics");
      const data = await res.json();
      return data.topics || [];
    },
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
    enabled: !!selectedThreadId,
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
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível criar a conversa.",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/chat/messages", {
        threadId: selectedThreadId,
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/threads", selectedThreadId] });
      setMessageInput("");
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível enviar a mensagem.",
      });
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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim() && selectedThreadId) {
      sendMessageMutation.mutate(messageInput.trim());
    }
  };

  const handleStartNewThread = () => {
    if (activeMode === "study" && !selectedTopicId) {
      toast({
        variant: "destructive",
        title: "Selecione um tópico",
        description: "Para Study Mode, precisa de selecionar um tópico.",
      });
      return;
    }
    createThreadMutation.mutate(activeMode);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentThread?.messages]);

  const currentThreads = activeMode === "study" ? studyThreads : existentialThreads;

  return (
    <div className="flex h-full">
      <div className="w-64 border-r flex flex-col">
        <div className="p-4 border-b">
          <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as ChatMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="study" data-testid="tab-study-mode">
                <Brain className="w-4 h-4 mr-2" />
                Study
              </TabsTrigger>
              <TabsTrigger value="existential" data-testid="tab-existential-mode">
                <Sparkles className="w-4 h-4 mr-2" />
                Life
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
                className={`group p-2 rounded hover-elevate cursor-pointer flex items-center justify-between ${
                  selectedThreadId === thread.id ? "bg-accent" : ""
                }`}
                onClick={() => setSelectedThreadId(thread.id)}
                data-testid={`thread-item-${thread.id}`}
              >
                <span className="text-sm truncate flex-1">
                  {thread.title || "Nova conversa"}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteThreadMutation.mutate(thread.id);
                  }}
                  data-testid={`button-delete-thread-${thread.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
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
    </div>
  );
}
