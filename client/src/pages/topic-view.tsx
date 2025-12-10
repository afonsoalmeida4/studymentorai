import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Upload, Link2, FileText, Sparkles, Trash2, ExternalLink, RefreshCw, Download } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useSubscription } from "@/hooks/useSubscription";
import SummaryStudySection from "@/components/SummaryStudySection";
import { UpgradeDialog } from "@/components/UpgradeDialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Topic, ContentItem } from "@shared/schema";

type LearningStyle = "visual" | "auditivo" | "logico" | "conciso";

type TopicSummary = {
  id: string;
  summary: string;
  motivationalMessage: string;
  updatedAt: Date;
};

type TopicSummariesResponse = {
  success: boolean;
  summaries: Partial<Record<LearningStyle, TopicSummary>>;
  count: number;
  hasContent: boolean;
};

export default function TopicView() {
  const params = useParams<{ id: string }>();
  const topicId = params.id;
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [generateSummary, setGenerateSummary] = useState(true);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [selectedLearningStyles, setSelectedLearningStyles] = useState<LearningStyle[]>(["conciso"]);
  const [isGenerateStylesDialogOpen, setIsGenerateStylesDialogOpen] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<"uploads" | "chat" | "summaries" | "features">("uploads");
  const [styleToRegenerate, setStyleToRegenerate] = useState<LearningStyle | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const {
    subscription,
    usage,
    limits,
    isLoading: subscriptionLoading,
    error: subscriptionError,
    isUploadLimitReached,
    getUploadUsageText,
  } = useSubscription();

  const currentPlan = subscription?.plan || "free";

  // Sync selectedLearningStyles with limits when they load
  useEffect(() => {
    if (limits?.allowedLearningStyles && limits.allowedLearningStyles.length > 0) {
      setSelectedLearningStyles([limits.allowedLearningStyles[0]]);
    }
  }, [limits]);

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

  const { data: topicSummariesData, isLoading: topicSummariesLoading, refetch: refetchTopicSummaries } = useQuery<TopicSummariesResponse>({
    queryKey: ["/api/topics", topicId, "summaries", i18n.language],
    queryFn: async () => {
      if (!topicId) throw new Error("Topic ID required");
      const res = await fetch(`/api/topics/${topicId}/summaries?language=${i18n.language}`);
      if (!res.ok) throw new Error("Failed to fetch topic summaries");
      return res.json();
    },
    enabled: !!topicId,
  });

  const generateSummariesMutation = useMutation({
    mutationFn: async (learningStyles: LearningStyle[]) => {
      if (!topicId) throw new Error("Topic ID required");
      const results = [];
      for (const style of learningStyles) {
        const result = await apiRequest("POST", `/api/topics/${topicId}/summaries`, { learningStyle: style });
        results.push(result);
      }
      return results;
    },
    onSuccess: (_data, variables) => {
      const count = variables.length;
      toast({
        title: count === 1 
          ? t('topicView.generateStylesDialog.successOne') 
          : t('topicView.generateStylesDialog.successMultiple', { count }),
        description: count === 1 
          ? t('topicView.generateStylesDialog.successDescriptionOne')
          : t('topicView.generateStylesDialog.successDescriptionMultiple'),
      });
      refetchTopicSummaries();
      setIsGenerateStylesDialogOpen(false);
      setSelectedLearningStyles([]);
    },
    onError: (error: any) => {
      if (error.status === 403) {
        setUpgradeReason("summaries");
        setShowUpgradeDialog(true);
        setIsGenerateStylesDialogOpen(false);
      } else {
        toast({
          title: t('errors.generateSummaries'),
          description: error.message || t('errors.tryAgain'),
          variant: "destructive",
        });
      }
    },
    onSettled: () => {
      // Clear regeneration dialog state on success or error
      setStyleToRegenerate(null);
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
        throw Object.assign(new Error(error.error || "Upload failed"), { 
          status: res.status,
          upgradeRequired: error.upgradeRequired,
          errorCode: error.errorCode,
          params: error.params
        });
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content", topicId] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setGenerateSummary(true);
      setGdprConsent(false);
      toast({
        title: t('topicView.uploadDialog.success'),
        description: t('topicView.uploadDialog.successDescription'),
      });
    },
    onError: (error: any) => {
      if (error.status === 403) {
        setUpgradeReason("uploads");
        setShowUpgradeDialog(true);
        
        // Show translated error message in toast
        const translatedError = translateError(t, {
          errorCode: error.errorCode,
          params: error.params,
          error: error.message
        });
        
        toast({
          variant: "destructive",
          title: t('topicView.uploadDialog.error'),
          description: translatedError,
        });
      } else {
        toast({
          variant: "destructive",
          title: t('topicView.uploadDialog.error'),
          description: error.message,
        });
      }
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
        title: t('topicView.linkDialog.success'),
        description: t('topicView.linkDialog.successDescription'),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('topicView.linkDialog.error'),
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

  const getContentIcon = (type: string): React.ReactElement => {
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

  const handleManualGenerate = () => {
    if (selectedLearningStyles.length > 0) {
      generateSummariesMutation.mutate(selectedLearningStyles);
    }
  };

  const toggleLearningStyle = (style: LearningStyle) => {
    setSelectedLearningStyles(prev =>
      prev.includes(style)
        ? prev.filter(s => s !== style)
        : [...prev, style]
    );
  };

  const getMissingStyles = (): LearningStyle[] => {
    if (!limits) return []; // Don't show any styles until limits are loaded
    const existing = new Set(Object.keys(topicSummariesData?.summaries || {}) as LearningStyle[]);
    const allStyles: LearningStyle[] = ["visual", "auditivo", "logico", "conciso"];
    const allowedStyles = limits.allowedLearningStyles || ["conciso"];
    return allStyles.filter(style => !existing.has(style) && allowedStyles.includes(style));
  };

  const confirmRegenerate = () => {
    if (styleToRegenerate) {
      generateSummariesMutation.mutate([styleToRegenerate]);
    }
  };

  // Export summary as PDF or DOCX (Premium only)
  const handleExport = async (summaryId: string, format: 'pdf' | 'docx') => {
    // Check if user has Premium plan
    if (currentPlan !== 'premium') {
      setUpgradeReason('features');
      setShowUpgradeDialog(true);
      return;
    }

    setIsExportingPdf(true);
    try {
      const endpoint = format === 'pdf' 
        ? `/api/topic-summaries/${summaryId}/export-pdf`
        : `/api/topic-summaries/${summaryId}/export-docx`;
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        const error = await response.json();
        if (error.errorCode === 'PREMIUM_REQUIRED') {
          setUpgradeReason('features');
          setShowUpgradeDialog(true);
          return;
        }
        throw new Error(error.error || `Erro ao exportar ${format.toUpperCase()}`);
      }

      // Get filename from response headers or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="?(.+?)"?$/);
      const filename = filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1]) : `resumo.${format}`;

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: t('topicView.pdfExport.success'),
        description: t('topicView.pdfExport.successMessage'),
      });
    } catch (error: any) {
      console.error(`Error exporting ${format}:`, error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message || t('topicView.pdfExport.error'),
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <>
      <div className="p-3 sm:p-4 md:p-6 w-full max-w-7xl mx-auto overflow-x-hidden">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-1 sm:mb-2 break-words">{topic?.name || t('topicView.title')}</h1>
          {topic?.description && (
            <p className="text-sm sm:text-base text-muted-foreground break-words">{topic.description}</p>
          )}
        </div>

        {subscriptionError && (
          <Card className="mb-4 bg-destructive/10 border-destructive/20">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">
                {t('common.error')}: {t('errors.loadSubscription')}
              </p>
            </CardContent>
          </Card>
        )}

        {!subscriptionLoading && !subscriptionError && limits && usage && (
          <Card className="mb-4 bg-muted/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                {getUploadUsageText(t)}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
          <Button
            size="sm"
            onClick={() => {
              if (subscriptionError || (!subscriptionLoading && limits && usage && isUploadLimitReached())) {
                setUpgradeReason("uploads");
                setShowUpgradeDialog(true);
              } else if (!subscriptionLoading && limits && usage) {
                setIsUploadDialogOpen(true);
              }
            }}
            disabled={subscriptionLoading || !!subscriptionError || isUploadLimitReached()}
            data-testid="button-upload-file"
            className="text-xs sm:text-sm"
          >
            <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            {subscriptionLoading ? t('common.loading') : t('topicView.uploadFile')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLinkDialogOpen(true)}
            data-testid="button-add-link"
            className="text-xs sm:text-sm"
          >
            <Link2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            {t('topicView.addLink')}
          </Button>
        </div>

        {contents.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">{t('topicView.emptyState.title')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('topicView.emptyState.description')}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
              <TabsList className="inline-flex min-w-max">
                <TabsTrigger value="all" data-testid="tab-all-content" className="text-xs sm:text-sm px-2 sm:px-3">
                  {t('topicView.tabs.all')} ({contents.length})
                </TabsTrigger>
                <TabsTrigger value="files" data-testid="tab-files" className="text-xs sm:text-sm px-2 sm:px-3">
                  {t('topicView.tabs.files')} ({contents.filter((c) => c.contentType !== "link").length})
                </TabsTrigger>
                <TabsTrigger value="links" data-testid="tab-links" className="text-xs sm:text-sm px-2 sm:px-3">
                  {t('topicView.tabs.links')} ({contents.filter((c) => c.contentType === "link").length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="mt-6">
              <div className="grid gap-4">
                {contents.map((content) => (
                  <Card key={content.id} data-testid={`card-content-${content.id}`}>
                    <CardHeader className="p-3 sm:p-6">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className="flex-shrink-0">{getContentIcon(content.contentType)}</div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm sm:text-base truncate">{content.title}</CardTitle>
                            <CardDescription className="mt-1 text-xs">
                              {content.contentType.toUpperCase()}
                              {content.summaryId && (
                                <span className="ml-2 text-primary">
                                  <Sparkles className="w-3 h-3 inline mr-1" />
                                  {t('content.aiSummary')}
                                </span>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                        {content.contentType === "link" && content.metadata && typeof content.metadata === "object" && "url" in content.metadata ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => window.open((content.metadata as any)?.url, "_blank")}
                            data-testid={`button-open-link-${content.id}`}
                            className="flex-shrink-0 h-8 w-8"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        ) : null}
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
                      <CardHeader className="p-3 sm:p-6">
                        <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                          <div className="flex-shrink-0">{getContentIcon(content.contentType)}</div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm sm:text-base truncate">{content.title}</CardTitle>
                            <CardDescription className="mt-1 text-xs">
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
                      <CardHeader className="p-3 sm:p-6">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                            <Link2 className="w-4 h-4 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <CardTitle className="text-sm sm:text-base truncate">{content.title}</CardTitle>
                              {content.metadata && typeof content.metadata === "object" && "url" in content.metadata ? (
                                <CardDescription className="mt-1 text-xs truncate">
                                  {(content.metadata as any)?.url}
                                </CardDescription>
                              ) : null}
                            </div>
                          </div>
                          {content.metadata && typeof content.metadata === "object" && "url" in content.metadata ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => window.open((content.metadata as any)?.url, "_blank")}
                              data-testid={`button-visit-link-${content.id}`}
                              className="flex-shrink-0 h-8 w-8"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          ) : null}
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Secção de Resumos e Estudo - Inline */}
        {contents.length > 0 && (
          <div className="mt-12">
            <div className="mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-1 sm:mb-2">{t('topicView.summarySection.title')}</h2>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {t('topicView.summarySection.description')}
              </p>
            </div>

            {generateSummariesMutation.isPending ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
                  <p className="text-muted-foreground">{t('summaries.generatingSummary')}</p>
                  <p className="text-xs text-muted-foreground mt-2">{t('summaries.generatingWait')}</p>
                </CardContent>
              </Card>
            ) : topicSummariesLoading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">{t('summaries.loading')}</p>
                </CardContent>
              </Card>
            ) : topicSummariesData?.summaries && Object.keys(topicSummariesData.summaries).length > 0 ? (
              (() => {
                const summaries = topicSummariesData.summaries;
                const allowedStyles = limits?.allowedLearningStyles || ["conciso"];
                
                const visual = allowedStyles.includes("visual") ? summaries.visual : undefined;
                const auditivo = allowedStyles.includes("auditivo") ? summaries.auditivo : undefined;
                const logico = allowedStyles.includes("logico") ? summaries.logico : undefined;
                const conciso = allowedStyles.includes("conciso") ? summaries.conciso : undefined;
                
                const availableStyles = Object.keys(summaries).filter(style => 
                  allowedStyles.includes(style as LearningStyle)
                ) as LearningStyle[];
                const missingStyles = getMissingStyles();
                const gridClass = availableStyles.length === 1 ? "grid-cols-1" 
                  : availableStyles.length === 2 ? "grid-cols-2"
                  : availableStyles.length === 3 ? "grid-cols-3"
                  : "grid-cols-4";
                
                if (availableStyles.length === 0) {
                  return (
                    <Card>
                      <CardContent className="py-12 text-center space-y-6">
                        <Sparkles className="w-12 h-12 mx-auto text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {t('topicView.summarySection.noAllowedSummaries')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t('topicView.summarySection.generateAllowedStyle')}
                          </p>
                        </div>
                        <div className="max-w-sm mx-auto space-y-4">
                          <div className="space-y-3">
                            <Label className="text-sm font-medium">{t('topicView.generateStylesDialog.selectStyles')}</Label>
                            <div className="grid grid-cols-2 gap-3">
                              {getMissingStyles().map(style => (
                                <div key={style} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`style-${style}`}
                                    checked={selectedLearningStyles.includes(style)}
                                    onCheckedChange={() => toggleLearningStyle(style)}
                                    data-testid={`checkbox-style-${style}`}
                                  />
                                  <Label
                                    htmlFor={`style-${style}`}
                                    className="text-sm cursor-pointer capitalize"
                                  >
                                    {style}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                          <Button
                            onClick={handleManualGenerate}
                            disabled={generateSummariesMutation.isPending || selectedLearningStyles.length === 0}
                            data-testid="button-manual-generate"
                            className="w-full"
                          >
                            {generateSummariesMutation.isPending 
                              ? t('topicView.generateStylesDialog.generating')
                              : t('topicView.generateStylesDialog.generate')
                            }
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
                
                return (
                  <div className="space-y-4">
                    {missingStyles.length > 0 && (
                      <div className="flex justify-end">
                        <Button
                          onClick={() => {
                            setSelectedLearningStyles(missingStyles);
                            setIsGenerateStylesDialogOpen(true);
                          }}
                          variant="outline"
                          size="sm"
                          data-testid="button-generate-more-styles"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          {t('topicView.summarySection.generateMore')} ({missingStyles.length})
                        </Button>
                      </div>
                    )}
                  <Tabs defaultValue={availableStyles[0]} className="w-full">
                    <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 mb-2">
                      <TabsList className="inline-flex min-w-max">
                      {visual ? (
                        <TabsTrigger value="visual" data-testid="tab-summary-visual" className="text-xs sm:text-sm px-2 sm:px-3">
                          {t('topicView.generateStylesDialog.visual')}
                        </TabsTrigger>
                      ) : null}
                      {auditivo ? (
                        <TabsTrigger value="auditivo" data-testid="tab-summary-auditivo" className="text-xs sm:text-sm px-2 sm:px-3">
                          {t('topicView.generateStylesDialog.auditivo')}
                        </TabsTrigger>
                      ) : null}
                      {logico ? (
                        <TabsTrigger value="logico" data-testid="tab-summary-logico" className="text-xs sm:text-sm px-2 sm:px-3">
                          {t('topicView.generateStylesDialog.logico')}
                        </TabsTrigger>
                      ) : null}
                      {conciso ? (
                        <TabsTrigger value="conciso" data-testid="tab-summary-conciso" className="text-xs sm:text-sm px-2 sm:px-3">
                          {t('topicView.generateStylesDialog.conciso')}
                        </TabsTrigger>
                      ) : null}
                      </TabsList>
                    </div>

                    {visual ? (
                      <TabsContent value="visual" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
                        <Card>
                          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                              <CardTitle className="text-base sm:text-lg">{t('topicView.summarySection.visual.title')}</CardTitle>
                              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={isExportingPdf || currentPlan !== 'premium'}
                                      data-testid="button-export-visual"
                                      className="gap-1 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
                                    >
                                      <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                                      <span className="hidden sm:inline">{t('topicView.pdfExport.button')}</span>
                                      <span className="sm:hidden">{t('topicView.pdfExport.buttonShort', t('topicView.pdfExport.button'))}</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => handleExport(visual.id, 'pdf')} data-testid="menu-export-pdf-visual">
                                      {t('topicView.pdfExport.exportPdf')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExport(visual.id, 'docx')} data-testid="menu-export-docx-visual">
                                      {t('topicView.pdfExport.exportDocx')}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setStyleToRegenerate("visual")}
                                  disabled={generateSummariesMutation.isPending}
                                  data-testid="button-regenerate-visual"
                                  className="gap-1 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
                                >
                                  <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
                                  <span className="hidden sm:inline">{t('topicView.summarySection.regenerate')}</span>
                                  <span className="sm:hidden">{t('topicView.summarySection.regenerateShort', t('topicView.summarySection.regenerate'))}</span>
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="px-3 sm:px-6">
                            <p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-muted-foreground break-words">
                              {visual.summary}
                            </p>
                          </CardContent>
                        </Card>
                        {visual.motivationalMessage ? (
                          <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="pt-4">
                              <p className="text-sm italic text-primary">
                                {visual.motivationalMessage}
                              </p>
                            </CardContent>
                          </Card>
                        ) : null}
                        <SummaryStudySection summaryId={visual.id} />
                      </TabsContent>
                    ) : null}

                    {auditivo ? (
                      <TabsContent value="auditivo" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
                        <Card>
                          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                              <CardTitle className="text-base sm:text-lg">{t('topicView.summarySection.auditivo.title')}</CardTitle>
                              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={isExportingPdf || currentPlan !== 'premium'}
                                      data-testid="button-export-auditivo"
                                      className="gap-1 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
                                    >
                                      <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                                      <span className="hidden sm:inline">{t('topicView.pdfExport.button')}</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => handleExport(auditivo.id, 'pdf')} data-testid="menu-export-pdf-auditivo">
                                      {t('topicView.pdfExport.exportPdf')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExport(auditivo.id, 'docx')} data-testid="menu-export-docx-auditivo">
                                      {t('topicView.pdfExport.exportDocx')}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setStyleToRegenerate("auditivo")}
                                  disabled={generateSummariesMutation.isPending}
                                  data-testid="button-regenerate-auditivo"
                                  className="gap-1 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
                                >
                                  <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
                                  <span className="hidden sm:inline">{t('topicView.summarySection.regenerate')}</span>
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="px-3 sm:px-6">
                            <p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-muted-foreground break-words">
                              {auditivo.summary}
                            </p>
                          </CardContent>
                        </Card>
                        {auditivo.motivationalMessage ? (
                          <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="pt-4">
                              <p className="text-sm italic text-primary">
                                {auditivo.motivationalMessage}
                              </p>
                            </CardContent>
                          </Card>
                        ) : null}
                        <SummaryStudySection summaryId={auditivo.id} />
                      </TabsContent>
                    ) : null}

                    {logico ? (
                      <TabsContent value="logico" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
                        <Card>
                          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                              <CardTitle className="text-base sm:text-lg">{t('topicView.summarySection.logico.title')}</CardTitle>
                              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={isExportingPdf || currentPlan !== 'premium'}
                                      data-testid="button-export-logico"
                                      className="gap-1 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
                                    >
                                      <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                                      <span className="hidden sm:inline">{t('topicView.pdfExport.button')}</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => handleExport(logico.id, 'pdf')} data-testid="menu-export-pdf-logico">
                                      {t('topicView.pdfExport.exportPdf')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExport(logico.id, 'docx')} data-testid="menu-export-docx-logico">
                                      {t('topicView.pdfExport.exportDocx')}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setStyleToRegenerate("logico")}
                                  disabled={generateSummariesMutation.isPending}
                                  data-testid="button-regenerate-logico"
                                  className="gap-1 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
                                >
                                  <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
                                  <span className="hidden sm:inline">{t('topicView.summarySection.regenerate')}</span>
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="px-3 sm:px-6">
                            <p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-muted-foreground break-words">
                              {logico.summary}
                            </p>
                          </CardContent>
                        </Card>
                        {logico.motivationalMessage ? (
                          <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="pt-4">
                              <p className="text-sm italic text-primary">
                                {logico.motivationalMessage}
                              </p>
                            </CardContent>
                          </Card>
                        ) : null}
                        <SummaryStudySection summaryId={logico.id} />
                      </TabsContent>
                    ) : null}

                    {conciso ? (
                      <TabsContent value="conciso" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
                        <Card>
                          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                              <CardTitle className="text-base sm:text-lg">{t('topicView.summarySection.conciso.title')}</CardTitle>
                              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={isExportingPdf || currentPlan !== 'premium'}
                                      data-testid="button-export-conciso"
                                      className="gap-1 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
                                    >
                                      <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                                      <span className="hidden sm:inline">{t('topicView.pdfExport.button')}</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => handleExport(conciso.id, 'pdf')} data-testid="menu-export-pdf-conciso">
                                      {t('topicView.pdfExport.exportPdf')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExport(conciso.id, 'docx')} data-testid="menu-export-docx-conciso">
                                      {t('topicView.pdfExport.exportDocx')}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setStyleToRegenerate("conciso")}
                                  disabled={generateSummariesMutation.isPending}
                                  data-testid="button-regenerate-conciso"
                                  className="gap-1 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3"
                                >
                                  <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
                                  <span className="hidden sm:inline">{t('topicView.summarySection.regenerate')}</span>
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="px-3 sm:px-6">
                            <p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-muted-foreground break-words">
                              {conciso.summary}
                            </p>
                          </CardContent>
                        </Card>
                        {conciso.motivationalMessage ? (
                          <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="pt-4">
                              <p className="text-sm italic text-primary">
                                {conciso.motivationalMessage}
                              </p>
                            </CardContent>
                          </Card>
                        ) : null}
                        <SummaryStudySection summaryId={conciso.id} />
                      </TabsContent>
                    ) : null}
                  </Tabs>
                  </div>
                );
              })()
            ) : (
              <Card>
                <CardContent className="py-12 text-center space-y-6">
                  <Sparkles className="w-12 h-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Ainda não há resumos disponíveis para este tópico.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Escolhe um ou mais estilos de aprendizagem para gerar resumos.
                    </p>
                  </div>
                  <div className="max-w-sm mx-auto space-y-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">{t('topicView.generateStylesDialog.selectStyles')}</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {getMissingStyles().map(style => (
                          <div key={style} className="flex items-center space-x-2">
                            <Checkbox
                              id={`style-${style}`}
                              checked={selectedLearningStyles.includes(style)}
                              onCheckedChange={() => toggleLearningStyle(style)}
                              data-testid={`checkbox-style-${style}`}
                            />
                            <Label
                              htmlFor={`style-${style}`}
                              className="text-sm cursor-pointer capitalize"
                            >
                              {style}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      onClick={handleManualGenerate}
                      disabled={generateSummariesMutation.isPending || selectedLearningStyles.length === 0}
                      data-testid="button-manual-generate"
                      className="w-full"
                    >
                      {generateSummariesMutation.isPending 
                        ? t('topicView.generateStylesDialog.generating')
                        : t('topicView.generateStylesDialog.generate')
                      }
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <Dialog open={isGenerateStylesDialogOpen} onOpenChange={(open) => {
        setIsGenerateStylesDialogOpen(open);
        if (!open) {
          setSelectedLearningStyles([]);
        }
      }}>
        <DialogContent data-testid="dialog-generate-styles">
          <DialogHeader>
            <DialogTitle>{t('topicView.generateStylesDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('topicView.generateStylesDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              {getMissingStyles().map(style => (
                <div key={style} className="flex items-center space-x-2">
                  <Checkbox
                    id={`dialog-style-${style}`}
                    checked={selectedLearningStyles.includes(style)}
                    onCheckedChange={() => toggleLearningStyle(style)}
                    data-testid={`dialog-checkbox-style-${style}`}
                  />
                  <Label
                    htmlFor={`dialog-style-${style}`}
                    className="text-sm cursor-pointer capitalize"
                  >
                    {style}
                  </Label>
                </div>
              ))}
            </div>
            {getMissingStyles().length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('topicView.summarySection.allGenerated')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsGenerateStylesDialogOpen(false)}
              data-testid="button-cancel-generate-styles"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleManualGenerate}
              disabled={generateSummariesMutation.isPending || selectedLearningStyles.length === 0}
              data-testid="button-submit-generate-styles"
            >
              {generateSummariesMutation.isPending
                ? t('topicView.generateStylesDialog.generating')
                : t('topicView.generateStylesDialog.generate')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent data-testid="dialog-upload-file">
          <form onSubmit={handleUpload}>
            <DialogHeader>
              <DialogTitle>{t('topicView.uploadDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('topicView.uploadDialog.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="file-upload">{t('common.upload')}</Label>
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
                    {t('topicView.uploadDialog.fileSelected')}: {selectedFile.name}
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
                  {t('topicView.uploadDialog.generateSummary')}
                </Label>
              </div>
              <div className="flex items-start space-x-2 pt-2 border-t">
                <Checkbox
                  id="gdpr-consent"
                  checked={gdprConsent}
                  onCheckedChange={(checked) => setGdprConsent(checked as boolean)}
                  data-testid="checkbox-gdpr-consent"
                  className="mt-0.5"
                />
                <Label htmlFor="gdpr-consent" className="text-sm cursor-pointer text-muted-foreground leading-tight">
                  {t('topicView.uploadDialog.gdprConsent')}
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
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!selectedFile || !gdprConsent || uploadMutation.isPending}
                data-testid="button-submit-upload"
              >
                {uploadMutation.isPending ? t('topicView.uploadDialog.uploading') : t('topicView.uploadDialog.upload')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent data-testid="dialog-add-link">
          <form onSubmit={handleAddLink}>
            <DialogHeader>
              <DialogTitle>{t('topicView.linkDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('topicView.linkDialog.description')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="link-url">{t('topicView.linkDialog.urlLabel')}</Label>
                <Input
                  id="link-url"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder={t('topicView.linkDialog.urlPlaceholder')}
                  data-testid="input-link-url"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="link-title">{t('topicView.linkDialog.titleLabel')}</Label>
                <Input
                  id="link-title"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder={t('topicView.linkDialog.titlePlaceholder')}
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
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!linkUrl.trim() || linkMutation.isPending}
                data-testid="button-submit-link"
              >
                {linkMutation.isPending ? t('topicView.linkDialog.adding') : t('topicView.linkDialog.add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={styleToRegenerate !== null} onOpenChange={() => setStyleToRegenerate(null)}>
        <AlertDialogContent data-testid="dialog-confirm-regenerate">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('topicView.regenerateDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('topicView.regenerateDialog.description', { style: styleToRegenerate })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-regenerate">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRegenerate}
              data-testid="button-confirm-regenerate"
            >
              {t('topicView.regenerateDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        limitType={upgradeReason}
        currentPlan={currentPlan}
      />
    </>
  );
}
