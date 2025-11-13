import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ApiSummary, LearningStyle, GenerateSummaryResponse } from "@shared/schema";
import SummaryStudySection from "@/components/SummaryStudySection";
import { 
  Upload, 
  FileText, 
  Eye, 
  Volume2, 
  Brain, 
  Zap, 
  Sparkles, 
  CheckCircle2, 
  XCircle,
  Loader2,
  GraduationCap,
  Lightbulb,
  LogOut,
  BarChart3
} from "lucide-react";
import { Link } from "wouter";

const learningStylesConfig = [
  {
    id: "visual" as LearningStyle,
    title: "Visual",
    description: "Diagramas, imagens e organização visual",
    icon: Eye,
  },
  {
    id: "auditivo" as LearningStyle,
    title: "Auditivo",
    description: "Explicações narrativas e conversacionais",
    icon: Volume2,
  },
  {
    id: "logico" as LearningStyle,
    title: "Lógico",
    description: "Estruturas, passos e raciocínio analítico",
    icon: Brain,
  },
  {
    id: "conciso" as LearningStyle,
    title: "Conciso",
    description: "Pontos-chave diretos e objetivos",
    icon: Zap,
  },
];

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<LearningStyle | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<ApiSummary | null>(null);
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !selectedStyle) {
        throw new Error("Ficheiro e estilo de aprendizagem são obrigatórios");
      }

      const formData = new FormData();
      formData.append("pdf", selectedFile);
      formData.append("learningStyle", selectedStyle);

      const response = await fetch("/api/generate-summary", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao gerar resumo");
      }

      return response.json() as Promise<GenerateSummaryResponse>;
    },
    onSuccess: (data) => {
      if (data.success && data.summary) {
        setGeneratedSummary(data.summary);
        toast({
          title: "Resumo gerado com sucesso!",
          description: "O seu resumo personalizado está pronto.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data.error || "Não foi possível gerar o resumo.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao processar PDF",
        description: error.message,
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        setSelectedFile(file);
        setGeneratedSummary(null);
      } else {
        toast({
          variant: "destructive",
          title: "Tipo de ficheiro inválido",
          description: "Por favor, selecione apenas ficheiros PDF.",
        });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === "application/pdf") {
        setSelectedFile(file);
        setGeneratedSummary(null);
      } else {
        toast({
          variant: "destructive",
          title: "Tipo de ficheiro inválido",
          description: "Por favor, selecione apenas ficheiros PDF.",
        });
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setGeneratedSummary(null);
  };

  const handleGenerate = () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "Ficheiro em falta",
        description: "Por favor, selecione um ficheiro PDF.",
      });
      return;
    }
    if (!selectedStyle) {
      toast({
        variant: "destructive",
        title: "Estilo em falta",
        description: "Por favor, selecione um estilo de aprendizagem.",
      });
      return;
    }
    generateMutation.mutate();
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSelectedStyle(null);
    setGeneratedSummary(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Logout */}
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-primary" />
            <span className="text-xl font-semibold text-foreground">AI Study Mentor</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="outline" size="default" data-testid="button-dashboard">
                <BarChart3 className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="default"
              onClick={() => window.location.href = "/api/logout"}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10">
              <GraduationCap className="w-9 h-9 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            AI Study Mentor
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-6 leading-relaxed">
            Transforme os seus documentos PDF em resumos personalizados adaptados ao seu estilo de aprendizagem único
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Adapta-se a si</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              <span>Powered by GPT-5</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span>Poupe tempo</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Funcionalidades</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Summary Generator Feature */}
            <Card className="hover-elevate" data-testid="card-feature-summaries">
              <CardHeader>
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-3">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Resumos Personalizados</CardTitle>
                <CardDescription>
                  Gere resumos adaptados ao seu estilo de aprendizagem (Visual, Auditivo, Lógico ou Conciso)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Carregue um PDF e obtenha um resumo otimizado para a forma como aprende melhor
                </p>
              </CardContent>
            </Card>

            {/* Flashcards Feature */}
            <Card className="hover-elevate" data-testid="card-feature-flashcards">
              <CardHeader>
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-3">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Flashcards Interativos</CardTitle>
                <CardDescription>
                  Pratique com flashcards 3D gerados automaticamente a partir dos seus resumos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Teste os seus conhecimentos com perguntas e respostas criadas por IA
                </p>
              </CardContent>
            </Card>

            {/* Dashboard Feature */}
            <Link href="/dashboard">
              <Card className="hover-elevate h-full" data-testid="card-feature-dashboard">
                <CardHeader>
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-3">
                    <BarChart3 className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Dashboard de Progresso</CardTitle>
                  <CardDescription>
                    Acompanhe o seu progresso e receba recomendações de revisão personalizadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Visualize estatísticas, PDFs estudados e sessões recentes
                  </p>
                  <Button variant="outline" size="sm" className="w-full" data-testid="button-goto-dashboard">
                    Ver Dashboard
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="pb-16 px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Upload Section */}
          {!generatedSummary && (
            <>
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-2xl">Carregar Documento</CardTitle>
                  <CardDescription>
                    Selecione ou arraste um ficheiro PDF (máx. 10MB)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!selectedFile ? (
                    <div
                      className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                        dragActive
                          ? "border-primary bg-primary/5"
                          : "border-border hover-elevate"
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      data-testid="dropzone-upload"
                    >
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        data-testid="input-file"
                      />
                      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-base font-medium mb-2 text-foreground">
                        Clique para selecionar ou arraste o ficheiro
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Apenas ficheiros PDF até 10MB
                      </p>
                    </div>
                  ) : (
                    <Card className="border-primary/20 bg-primary/5" data-testid="card-selected-file">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0">
                            <FileText className="w-8 h-8 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate" data-testid="text-filename">
                              {selectedFile.name}
                            </p>
                            <p className="text-sm text-muted-foreground" data-testid="text-filesize">
                              {formatFileSize(selectedFile.size)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleRemoveFile}
                            data-testid="button-remove-file"
                          >
                            <XCircle className="w-5 h-5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>

              {/* Learning Style Selection */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-2xl">Estilo de Aprendizagem</CardTitle>
                  <CardDescription>
                    Escolha como prefere receber informação
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {learningStylesConfig.map((style) => {
                      const Icon = style.icon;
                      const isSelected = selectedStyle === style.id;
                      return (
                        <Card
                          key={style.id}
                          className={`cursor-pointer transition-all hover-elevate active-elevate-2 ${
                            isSelected
                              ? "border-primary border-2 bg-primary/5"
                              : "border-border"
                          }`}
                          onClick={() => setSelectedStyle(style.id)}
                          data-testid={`card-style-${style.id}`}
                        >
                          <CardContent className="p-6 text-center">
                            <Icon className="w-8 h-8 mx-auto mb-4 text-primary" />
                            <h3 className="text-xl font-semibold mb-2 text-foreground">
                              {style.title}
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {style.description}
                            </p>
                            {isSelected && (
                              <div className="mt-4">
                                <Badge variant="default" className="gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Selecionado
                                </Badge>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Generate Button */}
              <div className="flex justify-center">
                <Button
                  size="lg"
                  className="px-8 py-6 text-base font-semibold"
                  onClick={handleGenerate}
                  disabled={!selectedFile || !selectedStyle || generateMutation.isPending}
                  data-testid="button-generate"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      A processar...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Gerar Resumo
                    </>
                  )}
                </Button>
              </div>

              {generateMutation.isPending && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-6 text-center">
                    <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
                    <p className="text-base font-medium mb-2 text-foreground">
                      A extrair texto do PDF...
                    </p>
                    <p className="text-sm text-muted-foreground">
                      A gerar o seu resumo personalizado. Isto pode demorar alguns momentos.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Summary Display */}
          {generatedSummary && (
            <div className="space-y-6">
              <Card className="border-2">
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-2xl mb-2">Resumo Personalizado</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" data-testid="badge-filename">
                        <FileText className="w-3 h-3 mr-1" />
                        {generatedSummary.fileName}
                      </Badge>
                      <Badge variant="default" data-testid="badge-style">
                        {learningStylesConfig.find(s => s.id === generatedSummary.learningStyle)?.title}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">
                  <div
                    className="prose prose-lg max-w-none font-serif leading-loose text-foreground"
                    data-testid="text-summary"
                  >
                    {generatedSummary.summary.split('\n').map((paragraph, index) => (
                      paragraph.trim() && (
                        <p key={index} className="mb-4">
                          {paragraph}
                        </p>
                      )
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Motivational Message */}
              <Card className="border-2 border-primary/20 bg-primary/5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <Lightbulb className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p
                        className="text-xl italic font-light text-foreground leading-relaxed"
                        data-testid="text-motivation"
                      >
                        {generatedSummary.motivationalMessage}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Flashcards Study Section */}
              <SummaryStudySection summaryId={generatedSummary.id} />

              {/* Action Buttons */}
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  data-testid="button-new-summary"
                >
                  Novo Resumo
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
