import { useState } from "react";
import { useParams } from "wouter";
import { Upload, Link2, FileText, Sparkles, Trash2, ExternalLink } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Topic, ContentItem } from "@shared/schema";

export default function TopicView() {
  const params = useParams<{ id: string }>();
  const topicId = params.id;
  const { toast } = useToast();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [generateSummary, setGenerateSummary] = useState(true);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [isSummariesDialogOpen, setIsSummariesDialogOpen] = useState(false);

  const { data: topic } = useQuery<Topic>({
    queryKey: ["/api/topics", topicId],
    queryFn: async () => {
      const res = await fetch(`/api/topics/${topicId}`);
      if (!res.ok) throw new Error("Failed to fetch topic");
      const data = await res.json();
      return data.topic;
    },
  });

  const { data: contents = [] } = useQuery<ContentItem[]>({
    queryKey: ["/api/content", topicId],
    queryFn: async () => {
      const res = await fetch(`/api/content/${topicId}`);
      if (!res.ok) throw new Error("Failed to fetch contents");
      const data = await res.json();
      return data.content || [];
    },
  });

  const { data: topicSummariesData, isLoading: topicSummariesLoading, refetch: refetchTopicSummaries } = useQuery({
    queryKey: ["/api/topics", topicId, "summaries"],
    queryFn: async () => {
      if (!topicId) return null;
      const res = await fetch(`/api/topics/${topicId}/summaries`);
      if (!res.ok) throw new Error("Failed to fetch topic summaries");
      return res.json();
    },
  });

  const generateSummariesMutation = useMutation({
    mutationFn: async () => {
      if (!topicId) throw new Error("Topic ID required");
      return apiRequest("POST", `/api/topics/${topicId}/summaries`, {});
    },
    onSuccess: () => {
      toast({
        title: "Resumos gerados com sucesso!",
        description: "Os resumos do tópico foram criados para os 4 estilos de aprendizagem.",
      });
      refetchTopicSummaries();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao gerar resumos",
        description: error.message || "Não foi possível gerar os resumos. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !topicId) throw new Error("File and topic required");

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("topicId", topicId);
      formData.append("generateSummary", generateSummary.toString());

      const res = await fetch("/api/content/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content", topicId] });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setGenerateSummary(true);
      toast({
        title: "Ficheiro carregado!",
        description: generateSummary
          ? "O resumo está a ser gerado com IA..."
          : "Ficheiro adicionado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro no upload",
        description: error.message,
      });
    },
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/content/link", {
        topicId,
        url: linkUrl,
        title: linkTitle || linkUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content", topicId] });
      setIsLinkDialogOpen(false);
      setLinkUrl("");
      setLinkTitle("");
      toast({
        title: "Link adicionado!",
        description: "O link foi guardado com sucesso.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível adicionar o link.",
      });
    },
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile) {
      uploadMutation.mutate();
    }
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (linkUrl.trim()) {
      linkMutation.mutate();
    }
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case "pdf":
      case "docx":
      case "pptx":
        return <FileText className="w-4 h-4" />;
      case "link":
        return <Link2 className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const handleGenerateSummaries = () => {
    if (topicSummariesData?.hasContent) {
      // If summaries exist, just open dialog
      setIsSummariesDialogOpen(true);
    } else if (contents.length > 0) {
      // If no summaries but has content, generate then open
      setIsSummariesDialogOpen(true);
    }
  };

  const handleManualGenerate = () => {
    generateSummariesMutation.mutate();
  };

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">{topic?.name || "Tópico"}</h1>
          {topic?.description && (
            <p className="text-muted-foreground">{topic.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 mb-6">
          <Button
            onClick={() => setIsUploadDialogOpen(true)}
            data-testid="button-upload-file"
          >
            <Upload className="w-4 h-4 mr-2" />
            Carregar Ficheiro
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsLinkDialogOpen(true)}
            data-testid="button-add-link"
          >
            <Link2 className="w-4 h-4 mr-2" />
            Adicionar Link
          </Button>
          {contents.length > 0 && (
            <Button
              onClick={handleGenerateSummaries}
              variant="secondary"
              data-testid="button-generate-summaries"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {topicSummariesData?.hasContent ? "Ver Resumos" : "Gerar Resumos"}
            </Button>
          )}
        </div>

        {contents.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Nenhum conteúdo adicionado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Comece por carregar ficheiros (PDF, Word, PowerPoint) ou adicionar links.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-all-content">
                Todos ({contents.length})
              </TabsTrigger>
              <TabsTrigger value="files" data-testid="tab-files">
                Ficheiros ({contents.filter((c) => c.contentType !== "link").length})
              </TabsTrigger>
              <TabsTrigger value="links" data-testid="tab-links">
                Links ({contents.filter((c) => c.contentType === "link").length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <div className="grid gap-4">
                {contents.map((content) => (
                  <Card key={content.id} data-testid={`card-content-${content.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {getContentIcon(content.contentType)}
                          <div>
                            <CardTitle className="text-base">{content.title}</CardTitle>
                            <CardDescription className="mt-1">
                              {content.contentType.toUpperCase()}
                              {content.summaryId && (
                                <span className="ml-2 text-primary">
                                  <Sparkles className="w-3 h-3 inline mr-1" />
                                  Resumo IA disponível
                                </span>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                        {content.contentType === "link" && content.metadata && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open((content.metadata as any)?.url, "_blank")}
                            data-testid={`button-open-link-${content.id}`}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="files" className="mt-6">
              <div className="grid gap-4">
                {contents
                  .filter((c) => c.contentType !== "link")
                  .map((content) => (
                    <Card key={content.id} data-testid={`card-file-${content.id}`}>
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          {getContentIcon(content.contentType)}
                          <div>
                            <CardTitle className="text-base">{content.title}</CardTitle>
                            <CardDescription className="mt-1">
                              {content.contentType.toUpperCase()}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
              </div>
            </TabsContent>

            <TabsContent value="links" className="mt-6">
              <div className="grid gap-4">
                {contents
                  .filter((c) => c.contentType === "link")
                  .map((content) => (
                    <Card key={content.id} data-testid={`card-link-${content.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <Link2 className="w-4 h-4" />
                            <div>
                              <CardTitle className="text-base">{content.title}</CardTitle>
                              {content.metadata && (
                                <CardDescription className="mt-1">
                                  {(content.metadata as any)?.url}
                                </CardDescription>
                              )}
                            </div>
                          </div>
                          {content.metadata && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open((content.metadata as any)?.url, "_blank")}
                              data-testid={`button-visit-link-${content.id}`}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent data-testid="dialog-upload-file">
          <form onSubmit={handleUpload}>
            <DialogHeader>
              <DialogTitle>Carregar Ficheiro</DialogTitle>
              <DialogDescription>
                Suporta PDF, Word (DOCX) e PowerPoint (PPTX). Máximo 10MB.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="file-upload">Ficheiro</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.docx,.pptx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  data-testid="input-file-upload"
                  required
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selecionado: {selectedFile.name}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="generate-summary"
                  checked={generateSummary}
                  onCheckedChange={(checked) => setGenerateSummary(checked as boolean)}
                  data-testid="checkbox-generate-summary"
                />
                <Label htmlFor="generate-summary" className="text-sm cursor-pointer">
                  Gerar resumo com IA (recomendado)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUploadDialogOpen(false)}
                data-testid="button-cancel-upload"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!selectedFile || uploadMutation.isPending}
                data-testid="button-submit-upload"
              >
                {uploadMutation.isPending ? "A carregar..." : "Carregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent data-testid="dialog-add-link">
          <form onSubmit={handleAddLink}>
            <DialogHeader>
              <DialogTitle>Adicionar Link</DialogTitle>
              <DialogDescription>
                Adicione um link externo relevante para este tópico.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="link-url">URL</Label>
                <Input
                  id="link-url"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://exemplo.com"
                  data-testid="input-link-url"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="link-title">Título (opcional)</Label>
                <Input
                  id="link-title"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Deixe vazio para usar o URL"
                  data-testid="input-link-title"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLinkDialogOpen(false)}
                data-testid="button-cancel-link"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!linkUrl.trim() || linkMutation.isPending}
                data-testid="button-submit-link"
              >
                {linkMutation.isPending ? "A adicionar..." : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSummariesDialogOpen} onOpenChange={setIsSummariesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-summaries">
          <DialogHeader>
            <DialogTitle>Resumos do Tópico</DialogTitle>
            <DialogDescription>
              Resumo agregado de todo o conteúdo deste tópico, adaptado aos 4 estilos de aprendizagem
            </DialogDescription>
          </DialogHeader>
          {generateSummariesMutation.isPending ? (
            <div className="py-8 text-center">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
              <p className="text-muted-foreground">A gerar resumos...</p>
              <p className="text-xs text-muted-foreground mt-2">Isto pode demorar 1-2 minutos.</p>
            </div>
          ) : topicSummariesLoading ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">A carregar resumos...</p>
            </div>
          ) : topicSummariesData?.summaries && Object.keys(topicSummariesData.summaries).length > 0 ? (
            <Tabs defaultValue="visual" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="visual" data-testid="tab-visual">
                  Visual
                </TabsTrigger>
                <TabsTrigger value="auditivo" data-testid="tab-auditivo">
                  Auditivo
                </TabsTrigger>
                <TabsTrigger value="logico" data-testid="tab-logico">
                  Lógico
                </TabsTrigger>
                <TabsTrigger value="conciso" data-testid="tab-conciso">
                  Conciso
                </TabsTrigger>
              </TabsList>

              <TabsContent value="visual" className="mt-4">
                {topicSummariesData.summaries.visual ? (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Resumo Visual</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {topicSummariesData.summaries.visual.summary}
                        </p>
                      </CardContent>
                    </Card>
                    {topicSummariesData.summaries.visual.motivationalMessage && (
                      <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="pt-4">
                          <p className="text-sm italic text-primary">
                            {topicSummariesData.summaries.visual.motivationalMessage}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Resumo visual não disponível</p>
                )}
              </TabsContent>

              <TabsContent value="auditivo" className="mt-4">
                {topicSummariesData.summaries.auditivo ? (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Resumo Auditivo</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {topicSummariesData.summaries.auditivo.summary}
                        </p>
                      </CardContent>
                    </Card>
                    {topicSummariesData.summaries.auditivo.motivationalMessage && (
                      <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="pt-4">
                          <p className="text-sm italic text-primary">
                            {topicSummariesData.summaries.auditivo.motivationalMessage}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Resumo auditivo não disponível</p>
                )}
              </TabsContent>

              <TabsContent value="logico" className="mt-4">
                {topicSummariesData.summaries.logico ? (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Resumo Lógico</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {topicSummariesData.summaries.logico.summary}
                        </p>
                      </CardContent>
                    </Card>
                    {topicSummariesData.summaries.logico.motivationalMessage && (
                      <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="pt-4">
                          <p className="text-sm italic text-primary">
                            {topicSummariesData.summaries.logico.motivationalMessage}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Resumo lógico não disponível</p>
                )}
              </TabsContent>

              <TabsContent value="conciso" className="mt-4">
                {topicSummariesData.summaries.conciso ? (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Resumo Conciso</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {topicSummariesData.summaries.conciso.summary}
                        </p>
                      </CardContent>
                    </Card>
                    {topicSummariesData.summaries.conciso.motivationalMessage && (
                      <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="pt-4">
                          <p className="text-sm italic text-primary">
                            {topicSummariesData.summaries.conciso.motivationalMessage}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Resumo conciso não disponível</p>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="py-8 text-center space-y-4">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Ainda não há resumos disponíveis para este tópico.
              </p>
              <p className="text-xs text-muted-foreground">
                Clique no botão abaixo para criar resumos agregados de todo o conteúdo deste tópico.
              </p>
              <Button
                onClick={handleManualGenerate}
                disabled={generateSummariesMutation.isPending}
                data-testid="button-manual-generate"
              >
                {generateSummariesMutation.isPending ? "A gerar..." : "Gerar Resumos Agora"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
