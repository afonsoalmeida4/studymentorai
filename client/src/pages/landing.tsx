import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  GraduationCap,
  Sparkles,
  Brain,
  Zap,
  Eye,
  Volume2,
  FileText,
  Heart,
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="py-20 md:py-28 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-8">
            <div className="flex items-center justify-center w-20 h-20 rounded-xl bg-primary/10">
              <GraduationCap className="w-12 h-12 text-primary" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground">
            AI Study Mentor
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-4 leading-relaxed max-w-3xl mx-auto font-semibold">
            Organiza o teu conhecimento. Encontra o teu equilíbrio.
          </p>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto">
            Transforme documentos em conhecimento organizado com IA. Estude de forma personalizada e encontre apoio para a sua jornada de aprendizagem.
          </p>
          <Button
            size="lg"
            className="px-8 py-6 text-lg font-semibold"
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-login"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Começar Agora
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-card/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            Como Funciona
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-2">
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  1. Carregue o PDF
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Faça upload de qualquer documento PDF que queira estudar
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="p-8 text-center">
                <Brain className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  2. Escolha o Estilo
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Selecione como prefere aprender: visual, auditivo, lógico ou conciso
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="p-8 text-center">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  3. Receba o Resumo
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  A IA cria um resumo personalizado com mensagem motivacional
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Learning Styles Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            Estilos de Aprendizagem
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-2">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Eye className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-foreground">Visual</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Diagramas, imagens e organização visual do conteúdo
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Volume2 className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-foreground">Auditivo</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Explicações narrativas e conversacionais
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Brain className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-foreground">Lógico</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Estruturas, passos e raciocínio analítico
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Zap className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-foreground">Conciso</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Pontos-chave diretos e objetivos
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4 bg-card/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12 text-foreground">
            Porquê AI Study Mentor?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <Sparkles className="w-10 h-10 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2 text-foreground">Powered by GPT-5</h3>
              <p className="text-muted-foreground">
                Tecnologia de IA de ponta para resumos precisos
              </p>
            </div>
            <div>
              <Heart className="w-10 h-10 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2 text-foreground">Personalizado</h3>
              <p className="text-muted-foreground">
                Adaptado ao seu estilo único de aprendizagem
              </p>
            </div>
            <div>
              <Zap className="w-10 h-10 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2 text-foreground">Rápido</h3>
              <p className="text-muted-foreground">
                Resumos gerados em segundos, não horas
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
            Pronto para Melhorar os Seus Estudos?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Comece a criar resumos personalizados hoje. É rápido, fácil e gratuito.
          </p>
          <Button
            size="lg"
            className="px-8 py-6 text-lg font-semibold"
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-cta-login"
          >
            Entrar Agora
          </Button>
        </div>
      </section>
    </div>
  );
}
