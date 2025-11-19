import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { supportedLanguages, languageNames, type SupportedLanguage } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";

export function LanguageSelector() {
  const { i18n } = useTranslation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  const currentLanguage = (i18n.language as SupportedLanguage) || "pt";

  const updateLanguageMutation = useMutation({
    mutationFn: async ({ language, previousLanguage }: { language: SupportedLanguage, previousLanguage: SupportedLanguage }) => {
      await i18n.changeLanguage(language);
      if (isAuthenticated) {
        const result = await apiRequest("POST", "/api/user/language", { language });
        return result;
      }
      return null;
    },
    onSuccess: async () => {
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
    },
    onError: (error: any, { previousLanguage }) => {
      i18n.changeLanguage(previousLanguage);
      
      if (isAuthenticated) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: error.message || "Erro ao atualizar idioma",
        });
      }
    },
  });

  const handleLanguageChange = (language: string) => {
    const lang = language as SupportedLanguage;
    const previousLanguage = currentLanguage;
    updateLanguageMutation.mutate({ language: lang, previousLanguage });
  };

  return (
    <Select value={currentLanguage} onValueChange={handleLanguageChange}>
      <SelectTrigger
        className="w-[160px]"
        data-testid="select-language"
      >
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {supportedLanguages.map((lang) => (
          <SelectItem
            key={lang}
            value={lang}
            data-testid={`option-language-${lang}`}
          >
            {languageNames[lang]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
