import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  GraduationCap,
  Sparkles,
  Brain,
  Zap,
  Eye,
  Volume2,
  FileText,
  Heart,
  BookOpen,
  Trophy,
  Target,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

export default function Landing() {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogin = () => {
    // If already authenticated, go to home instead of forcing OAuth again
    // Note: App.tsx handles automatic routing, this is only for manual button clicks
    if (user) {
      setLocation("/");
    } else {
      window.location.href = "/api/login";
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="w-full max-w-6xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xl font-bold text-foreground">
              AI Study Mentor
            </span>
          </div>
          <LanguageSelector />
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-28 px-6 md:px-12">
        <div className="w-full max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            {t('landing.hero.badge')}
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground leading-tight">
            {t('landing.hero.title')}
          </h1>
          <p className="text-xl text-muted-foreground mb-4 leading-relaxed font-semibold">
            {t('app.tagline')}
          </p>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto">
            {t('landing.hero.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="px-8 text-lg font-semibold"
              onClick={handleLogin}
              data-testid="button-login"
              disabled={isLoading}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {t('landing.hero.cta')}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-8 text-lg font-semibold"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              data-testid="button-learn-more"
            >
              {t('landing.hero.learnMore')}
            </Button>
          </div>
          
          {/* Visual Mockup */}
          <div className="mt-16 max-w-3xl mx-auto">
            <div className="rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 hover-elevate">
                  <BookOpen className="w-8 h-8 text-primary mb-2 mx-auto" />
                  <div className="h-2 bg-primary/20 rounded mb-1" />
                  <div className="h-2 bg-primary/10 rounded w-2/3 mx-auto" />
                </Card>
                <Card className="p-4 hover-elevate">
                  <Brain className="w-8 h-8 text-primary mb-2 mx-auto" />
                  <div className="h-2 bg-primary/20 rounded mb-1" />
                  <div className="h-2 bg-primary/10 rounded w-2/3 mx-auto" />
                </Card>
                <Card className="p-4 hover-elevate">
                  <Trophy className="w-8 h-8 text-primary mb-2 mx-auto" />
                  <div className="h-2 bg-primary/20 rounded mb-1" />
                  <div className="h-2 bg-primary/10 rounded w-2/3 mx-auto" />
                </Card>
                <Card className="p-4 hover-elevate">
                  <Target className="w-8 h-8 text-primary mb-2 mx-auto" />
                  <div className="h-2 bg-primary/20 rounded mb-1" />
                  <div className="h-2 bg-primary/10 rounded w-2/3 mx-auto" />
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 md:px-12 bg-card/30">
        <div className="w-full max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-foreground">
              {t('landing.features.title')}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('landing.features.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-2 hover-elevate">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  {t('landing.features.uploadPdf.title')}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t('landing.features.uploadPdf.description')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover-elevate">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  {t('landing.features.chooseStyle.title')}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t('landing.features.chooseStyle.description')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover-elevate">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  {t('landing.features.getSummary.title')}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t('landing.features.getSummary.description')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover-elevate">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Target className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  {t('landing.features.flashcards.title')}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t('landing.features.flashcards.description')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover-elevate">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Trophy className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">
                  {t('landing.features.gamification.title')}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t('landing.features.gamification.description')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Learning Styles Section */}
      <section className="py-20 px-6 md:px-12">
        <div className="w-full max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-foreground">
              {t('landing.learningStyles.title')}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('landing.learningStyles.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-2 hover-elevate">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Eye className="w-6 h-6 text-primary" />
                  </div>
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

            <Card className="border-2 hover-elevate">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Volume2 className="w-6 h-6 text-primary" />
                  </div>
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

            <Card className="border-2 hover-elevate">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-6 h-6 text-primary" />
                  </div>
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

            <Card className="border-2 hover-elevate">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
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
      <section className="py-20 px-6 md:px-12 bg-card/30">
        <div className="w-full max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-foreground">
              {t('landing.benefits.title')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">
                {t('landing.benefits.aiPowered.title')}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t('landing.benefits.aiPowered.description')}
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Heart className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">
                {t('landing.benefits.personalized.title')}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t('landing.benefits.personalized.description')}
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">
                {t('landing.benefits.fast.title')}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t('landing.benefits.fast.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 md:px-12">
        <div className="w-full max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
            {t('landing.cta.title')}
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            {t('landing.cta.description')}
          </p>
          <Button
            size="lg"
            className="px-12 py-6 text-lg font-semibold"
            onClick={handleLogin}
            data-testid="button-cta-login"
            disabled={isLoading}
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {t('landing.cta.button')}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6 md:px-12">
        <div className="w-full max-w-6xl mx-auto text-center text-sm text-muted-foreground space-y-2">
          <p>© 2024 AI Study Mentor. {t('landing.footer.rights')}</p>
          <a 
            href="/privacy" 
            className="text-primary hover:underline"
            data-testid="link-privacy-policy"
          >
            {t('landing.footer.privacy')}
          </a>
        </div>
      </footer>
    </div>
  );
}
