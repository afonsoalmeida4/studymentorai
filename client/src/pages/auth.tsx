import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { translateSupabaseError } from "@/lib/errorTranslation";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { LanguageSelector } from "@/components/LanguageSelector";
import { GraduationCap, Loader2, Mail, Lock, User, ArrowLeft, Sparkles } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { motion } from "framer-motion";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;

export default function AuthPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [isLoading, setIsLoading] = useState(false);
  const { login, signup, loginWithGoogle } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signupForm = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    },
  });

  const handleLogin = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      toast({
        title: t("auth.loginSuccess"),
        description: t("auth.welcomeBack"),
      });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: t("auth.loginError"),
        description: translateSupabaseError(t, error.message) || t("auth.invalidCredentials"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (data: SignupForm) => {
    setIsLoading(true);
    try {
      await signup(data.email, data.password, {
        firstName: data.firstName,
        lastName: data.lastName,
      });
      toast({
        title: t("auth.signupSuccess"),
        description: t("auth.checkEmail"),
      });
      setMode("login");
    } catch (error: any) {
      toast({
        title: t("auth.signupError"),
        description: translateSupabaseError(t, error.message),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle();
    } catch (error: any) {
      toast({
        title: t("auth.loginError"),
        description: translateSupabaseError(t, error.message),
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="w-full max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-2 cursor-pointer"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            onClick={() => setLocation("/")}
          >
            <Button variant="ghost" size="icon" className="mr-2" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-600 shadow-lg shadow-primary/25">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Study Mentor AI
            </span>
          </motion.div>
          <LanguageSelector />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 pt-20 pb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-violet-500/5 to-rose-500/5" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md"
        >
          <Card className="bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
            <CardHeader className="text-center pb-2">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-violet-600 shadow-lg shadow-primary/25">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">
                {mode === "login" ? t("auth.loginTitle") : t("auth.signupTitle")}
              </CardTitle>
              <CardDescription className="flex items-center justify-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                {t("auth.subtitle")}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                data-testid="button-google-login"
              >
                <SiGoogle className="h-4 w-4" />
                {t("auth.continueWithGoogle")}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    {t("auth.orContinueWith")}
                  </span>
                </div>
              </div>

              {mode === "login" ? (
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("auth.email")}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                              <Input
                                type="email"
                                autoComplete="email"
                                placeholder={t("auth.emailPlaceholder")}
                                className="pl-10"
                                {...field}
                                data-testid="input-email"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("auth.password")}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                              <Input
                                type="password"
                                autoComplete="current-password"
                                placeholder={t("auth.passwordPlaceholder")}
                                className="pl-10"
                                {...field}
                                data-testid="input-password"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
                      disabled={isLoading}
                      data-testid="button-login"
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t("auth.login")}
                    </Button>
                  </form>
                </Form>
              ) : (
                <Form {...signupForm}>
                  <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={signupForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("auth.firstName")}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                                <Input
                                  type="text"
                                  autoComplete="given-name"
                                  placeholder={t("auth.firstNamePlaceholder")}
                                  className="pl-10"
                                  {...field}
                                  data-testid="input-first-name"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={signupForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("auth.lastName")}</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                autoComplete="family-name"
                                placeholder={t("auth.lastNamePlaceholder")}
                                {...field}
                                data-testid="input-last-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    {/* Hidden honeypot fields to confuse password managers */}
                    <input type="text" name="username" autoComplete="username" className="sr-only" tabIndex={-1} aria-hidden="true" />
                    <input type="password" name="pwd" autoComplete="current-password" className="sr-only" tabIndex={-1} aria-hidden="true" />
                    
                    <FormField
                      control={signupForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("auth.email")}</FormLabel>
                          <FormControl>
                            <div className="relative" data-1p-ignore data-lpignore="true" data-form-type="other">
                              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                              <input
                                type="text"
                                inputMode="email"
                                name="user_contact"
                                id="user_contact"
                                autoComplete="nope"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                data-1p-ignore
                                data-lpignore="true"
                                data-form-type="other"
                                placeholder={t("auth.emailPlaceholder")}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pl-10"
                                value={field.value}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                data-testid="input-signup-email"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("auth.password")}</FormLabel>
                          <FormControl>
                            <div className="relative" data-1p-ignore data-lpignore="true">
                              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                              <input
                                type="password"
                                name="user_secret"
                                id="user_secret"
                                autoComplete="new-password"
                                data-1p-ignore
                                data-lpignore="true"
                                placeholder={t("auth.passwordPlaceholder")}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pl-10"
                                value={field.value}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                data-testid="input-signup-password"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
                      disabled={isLoading}
                      data-testid="button-signup"
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t("auth.signup")}
                    </Button>
                  </form>
                </Form>
              )}

              <div className="text-center text-sm">
                {mode === "login" ? (
                  <>
                    {t("auth.noAccount")}{" "}
                    <button
                      type="button"
                      className="text-primary hover:underline font-medium"
                      onClick={() => setMode("signup")}
                      data-testid="button-switch-to-signup"
                    >
                      {t("auth.signupLink")}
                    </button>
                  </>
                ) : (
                  <>
                    {t("auth.hasAccount")}{" "}
                    <button
                      type="button"
                      className="text-primary hover:underline font-medium"
                      onClick={() => setMode("login")}
                      data-testid="button-switch-to-login"
                    >
                      {t("auth.loginLink")}
                    </button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
