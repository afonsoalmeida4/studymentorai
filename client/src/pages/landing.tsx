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
import { useTranslation } from "react-i18next";

export default function Landing() {
  const { t } = useTranslation();
  
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
            {t('landing.hero.title')}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-4 leading-relaxed max-w-3xl mx-auto font-semibold">
            {t('app.tagline')}
          </p>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto">
            {t('landing.hero.description')}
          </p>
          <Button
            size="lg"
            className="px-8 py-6 text-lg font-semibold"
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-login"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {t('landing.hero.cta')}
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-card/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            {t('landing.features.title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-2">
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  {t('landing.features.uploadPdf.title')}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t('landing.features.uploadPdf.description')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="p-8 text-center">
                <Brain className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  {t('landing.features.chooseStyle.title')}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t('landing.features.chooseStyle.description')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="p-8 text-center">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  {t('landing.features.getSummary.title')}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t('landing.features.getSummary.description')}
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
            {t('landing.learningStyles.title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-2">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Eye className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-foreground">
                      {t('landing.learningStyles.visual.title')}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {t('landing.learningStyles.visual.description')}
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
                    <h3 className="text-xl font-semibold mb-2 text-foreground">
                      {t('landing.learningStyles.auditory.title')}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {t('landing.learningStyles.auditory.description')}
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
                    <h3 className="text-xl font-semibold mb-2 text-foreground">
                      {t('landing.learningStyles.logical.title')}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {t('landing.learningStyles.logical.description')}
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
                    <h3 className="text-xl font-semibold mb-2 text-foreground">
                      {t('landing.learningStyles.concise.title')}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {t('landing.learningStyles.concise.description')}
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
            {t('landing.benefits.title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <Sparkles className="w-10 h-10 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                {t('landing.benefits.aiPowered.title')}
              </h3>
              <p className="text-muted-foreground">
                {t('landing.benefits.aiPowered.description')}
              </p>
            </div>
            <div>
              <Heart className="w-10 h-10 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                {t('landing.benefits.personalized.title')}
              </h3>
              <p className="text-muted-foreground">
                {t('landing.benefits.personalized.description')}
              </p>
            </div>
            <div>
              <Zap className="w-10 h-10 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2 text-foreground">
                {t('landing.benefits.fast.title')}
              </h3>
              <p className="text-muted-foreground">
                {t('landing.benefits.fast.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
            {t('landing.cta.title')}
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            {t('landing.cta.description')}
          </p>
          <Button
            size="lg"
            className="px-8 py-6 text-lg font-semibold"
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-cta-login"
          >
            {t('landing.cta.button')}
          </Button>
        </div>
      </section>
    </div>
  );
}
