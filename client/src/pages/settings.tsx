import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { translateSupabaseError } from "@/lib/errorTranslation";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Settings, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "required"),
  newPassword: z.string().min(6, "min6"),
  confirmPassword: z.string().min(1, "required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "passwordsDoNotMatch",
  path: ["confirmPassword"],
});

type PasswordForm = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { t } = useTranslation();
  const { session, updatePassword } = useAuth();
  const { toast } = useToast();
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const isGoogleUser = session?.user?.app_metadata?.provider === "google";

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const translateAuthError = (errorMessage: string): string => {
    if (errorMessage === "Current password is incorrect") {
      return t("settings.currentPasswordIncorrect");
    }
    if (errorMessage === "No active session") {
      return t("errors.unauthorized");
    }
    if (errorMessage.includes("Cannot change password")) {
      return t("settings.googlePasswordNote");
    }
    const translated = translateSupabaseError(t, errorMessage);
    return translated !== errorMessage ? translated : t("errors.generic");
  };

  const handlePasswordChange = async (data: PasswordForm) => {
    if (isGoogleUser || isPasswordLoading) return;
    setIsPasswordLoading(true);
    try {
      await updatePassword(data.currentPassword, data.newPassword);
      toast({
        title: t("settings.passwordChanged"),
        description: t("settings.passwordChangedDesc"),
      });
      passwordForm.reset();
    } catch (error: any) {
      toast({
        title: t("settings.passwordChangeError"),
        description: translateAuthError(error.message),
        variant: "destructive",
      });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const getPasswordFormError = (field: keyof PasswordForm): string | undefined => {
    const error = passwordForm.formState.errors[field]?.message;
    if (!error) return undefined;
    if (error === "required") return t("settings.fieldRequired");
    if (error === "min6") return t("settings.passwordMin6");
    if (error === "passwordsDoNotMatch") return t("settings.passwordsDoNotMatch");
    return error;
  };

  return (
    <div className="container max-w-2xl mx-auto py-6 px-4 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-settings-title">
              {t("settings.title")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("settings.subtitle")}
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg">{t("settings.changePassword")}</CardTitle>
            </div>
            <CardDescription>
              {isGoogleUser 
                ? t("settings.googlePasswordNote")
                : t("settings.changePasswordDesc")}
            </CardDescription>
          </CardHeader>
          {!isGoogleUser && (
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("settings.currentPassword")}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showCurrentPassword ? "text" : "password"}
                              placeholder="••••••••"
                              data-testid="input-current-password"
                              autoComplete="current-password"
                              data-1p-ignore="true"
                              data-lpignore="true"
                              disabled={isPasswordLoading}
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              data-testid="button-toggle-current-password"
                            >
                              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        {passwordForm.formState.errors.currentPassword && (
                          <p className="text-sm text-destructive">{getPasswordFormError("currentPassword")}</p>
                        )}
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("settings.newPassword")}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showNewPassword ? "text" : "password"}
                              placeholder={t("settings.newPasswordPlaceholder")}
                              data-testid="input-new-password"
                              autoComplete="new-password"
                              data-1p-ignore="true"
                              data-lpignore="true"
                              disabled={isPasswordLoading}
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              data-testid="button-toggle-new-password"
                            >
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        {passwordForm.formState.errors.newPassword && (
                          <p className="text-sm text-destructive">{getPasswordFormError("newPassword")}</p>
                        )}
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("settings.confirmPassword")}</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            data-testid="input-confirm-password"
                            autoComplete="new-password"
                            data-1p-ignore="true"
                            data-lpignore="true"
                            disabled={isPasswordLoading}
                            {...field}
                          />
                        </FormControl>
                        {passwordForm.formState.errors.confirmPassword && (
                          <p className="text-sm text-destructive">{getPasswordFormError("confirmPassword")}</p>
                        )}
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    disabled={isPasswordLoading}
                    data-testid="button-change-password"
                  >
                    {isPasswordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("settings.changePasswordButton")}
                  </Button>
                </form>
              </Form>
            </CardContent>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
