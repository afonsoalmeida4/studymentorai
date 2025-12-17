import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LanguageSelector } from "@/components/LanguageSelector";
import {
  GraduationCap,
  Sparkles,
  Brain,
  Zap,
  Eye,
  FileText,
  Heart,
  BookOpen,
  Trophy,
  Target,
  MessageSquare,
  Calendar,
  BarChart3,
  Flame,
  Languages,
  Check,
  Crown,
  Star,
  Globe,
  Layers,
  FolderTree,
  ArrowRight,
  Play,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function Landing() {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogin = () => {
    if (user) {
      setLocation("/");
    } else {
      window.location.href = "/api/login";
    }
  };
  
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="w-full max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <motion.div 
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-600 shadow-lg shadow-primary/25">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Study Mentor AI
            </span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <LanguageSelector />
          </motion.div>
        </div>
      </header>

      <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 px-4 md:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-violet-500/5 to-rose-500/5" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        
        <div className="relative w-full max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-6 px-4 py-2 text-sm font-medium bg-gradient-to-r from-primary/10 to-violet-500/10 text-primary border-primary/20 hover:bg-primary/15">
              <Sparkles className="w-4 h-4 mr-2" />
              {t('landing.hero.badge')}
            </Badge>
          </motion.div>
          
          <motion.h1 
            className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
              {t('landing.hero.title')}
            </span>
          </motion.h1>
          
          <motion.p 
            className="text-lg md:text-xl text-primary font-semibold mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {t('app.tagline')}
          </motion.p>
          
          <motion.p 
            className="text-base md:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {t('landing.hero.description')}
          </motion.p>
          
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Button
              size="lg"
              className="px-8 text-base font-semibold bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
              onClick={handleLogin}
              data-testid="button-login"
              disabled={isLoading}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {t('landing.hero.cta')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-8 text-base font-semibold border-2 hover:bg-muted/50 transition-all duration-300"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              data-testid="button-learn-more"
            >
              <Play className="w-4 h-4 mr-2" />
              {t('landing.hero.learnMore')}
            </Button>
          </motion.div>
          
          <motion.div 
            className="mt-16 max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <div className="relative rounded-2xl bg-gradient-to-br from-card via-card to-muted/50 border border-border/50 p-6 md:p-8 shadow-2xl shadow-primary/5">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 rounded-2xl" />
              <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: FolderTree, label: t('landing.mockup.organize'), color: "from-blue-500 to-cyan-500", bg: "from-blue-500/10 to-cyan-500/10" },
                  { icon: Brain, label: t('landing.mockup.flashcards'), color: "from-violet-500 to-purple-500", bg: "from-violet-500/10 to-purple-500/10" },
                  { icon: MessageSquare, label: t('landing.mockup.aiMentor'), color: "from-emerald-500 to-teal-500", bg: "from-emerald-500/10 to-teal-500/10" },
                  { icon: Trophy, label: t('landing.mockup.gamification'), color: "from-amber-500 to-orange-500", bg: "from-amber-500/10 to-orange-500/10" },
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                  >
                    <Card className="relative overflow-hidden p-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/50">
                      <div className={`absolute inset-0 bg-gradient-to-br ${item.bg}`} />
                      <div className="relative">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                          <item.icon className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-xs font-medium text-foreground">{item.label}</p>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="py-20 px-4 md:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-transparent to-muted/30" />
        <div className="relative w-full max-w-6xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4 px-3 py-1 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
              <Zap className="w-3 h-3 mr-1" />
              Core Features
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('landing.features.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('landing.features.subtitle')}
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Layers, title: t('landing.features.organization.title'), desc: t('landing.features.organization.description'), color: "from-blue-500 to-cyan-500", bg: "from-blue-500/10 to-cyan-500/10" },
              { icon: FileText, title: t('landing.features.uploadPdf.title'), desc: t('landing.features.uploadPdf.description'), color: "from-violet-500 to-purple-500", bg: "from-violet-500/10 to-purple-500/10" },
              { icon: Sparkles, title: t('landing.features.getSummary.title'), desc: t('landing.features.getSummary.description'), color: "from-amber-500 to-orange-500", bg: "from-amber-500/10 to-orange-500/10" },
              { icon: Target, title: t('landing.features.flashcards.title'), desc: t('landing.features.flashcards.description'), color: "from-emerald-500 to-teal-500", bg: "from-emerald-500/10 to-teal-500/10" },
              { icon: MessageSquare, title: t('landing.features.dualChat.title'), desc: t('landing.features.dualChat.description'), color: "from-rose-500 to-pink-500", bg: "from-rose-500/10 to-pink-500/10" },
              { icon: Trophy, title: t('landing.features.gamification.title'), desc: t('landing.features.gamification.description'), color: "from-amber-500 to-yellow-500", bg: "from-amber-500/10 to-yellow-500/10" },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="relative overflow-hidden h-full hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-border/50">
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.bg} opacity-50`} />
                  <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${feature.color} rounded-l-md`} />
                  <CardContent className="relative p-6">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-primary/5 to-rose-500/5" />
        <div className="relative w-full max-w-6xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4 px-3 py-1 bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
              <Crown className="w-3 h-3 mr-1" />
              {t('landing.premium.badge')}
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('landing.premium.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('landing.premium.subtitle')}
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: BarChart3, title: t('landing.premium.dashboard.title'), desc: t('landing.premium.dashboard.description'), color: "from-blue-500 to-indigo-500" },
              { icon: Calendar, title: t('landing.premium.calendar.title'), desc: t('landing.premium.calendar.description'), color: "from-violet-500 to-purple-500" },
              { icon: Flame, title: t('landing.premium.stats.title'), desc: t('landing.premium.stats.description'), color: "from-orange-500 to-red-500" },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="relative overflow-hidden h-full text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-amber-200/50 dark:border-amber-800/50">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5" />
                  <CardContent className="relative p-8">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                      <item.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-transparent to-transparent" />
        <div className="relative w-full max-w-6xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('landing.learningStyles.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('landing.learningStyles.subtitle')}
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Eye, title: t('landing.learningStyles.visual.title'), desc: t('landing.learningStyles.visual.description'), color: "from-cyan-500 to-blue-500" },
              { icon: Brain, title: t('landing.learningStyles.logical.title'), desc: t('landing.learningStyles.logical.description'), color: "from-violet-500 to-purple-500" },
              { icon: Zap, title: t('landing.learningStyles.concise.title'), desc: t('landing.learningStyles.concise.description'), color: "from-amber-500 to-orange-500" },
            ].map((style, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="relative overflow-hidden h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                        <style.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">{style.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{style.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-violet-500/5 to-transparent" />
        <motion.div 
          className="relative w-full max-w-4xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center mx-auto mb-8 shadow-xl shadow-primary/25">
            <Globe className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t('landing.i18n.title')}
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t('landing.i18n.description')}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { name: 'Portugues', flag: 'PT' },
              { name: 'English', flag: 'EN' },
              { name: 'Espanol', flag: 'ES' },
              { name: 'Francais', flag: 'FR' },
              { name: 'Deutsch', flag: 'DE' },
              { name: 'Italiano', flag: 'IT' },
            ].map((lang, index) => (
              <motion.div
                key={lang.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Badge variant="secondary" className="px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors">
                  <span className="font-bold mr-2 text-primary">{lang.flag}</span>
                  {lang.name}
                </Badge>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="py-20 px-4 md:px-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/30 to-muted/30" />
        <div className="relative w-full max-w-6xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t('landing.benefits.title')}
            </h2>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Sparkles, title: t('landing.benefits.aiPowered.title'), desc: t('landing.benefits.aiPowered.description'), color: "from-violet-500 to-purple-500" },
              { icon: Heart, title: t('landing.benefits.personalized.title'), desc: t('landing.benefits.personalized.description'), color: "from-rose-500 to-pink-500" },
              { icon: Zap, title: t('landing.benefits.fast.title'), desc: t('landing.benefits.fast.description'), color: "from-amber-500 to-orange-500" },
            ].map((benefit, index) => (
              <motion.div
                key={index}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${benefit.color} flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                  <benefit.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{benefit.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{benefit.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-4 md:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-violet-500/10 to-rose-500/10" />
        <div className="absolute top-10 left-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl" />
        
        <motion.div 
          className="relative w-full max-w-4xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            {t('landing.cta.title')}
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            {t('landing.cta.description')}
          </p>
          <Button
            size="lg"
            className="px-12 py-6 text-lg font-semibold bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-xl shadow-primary/30 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-1"
            onClick={handleLogin}
            data-testid="button-cta-login"
            disabled={isLoading}
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {t('landing.cta.button')}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>
      </section>

      <footer className="border-t border-border/50 py-8 px-4 md:px-8 bg-muted/30">
        <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium">Study Mentor AI</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>© 2024 {t('landing.footer.rights')}</span>
            <a 
              href="/privacy" 
              className="text-primary hover:underline transition-colors"
              data-testid="link-privacy-policy"
            >
              {t('landing.footer.privacy')}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
