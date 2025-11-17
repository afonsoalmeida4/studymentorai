import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";

export function useLanguageSync() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const typedUser = user as User | null;

  useEffect(() => {
    if (typedUser?.language && i18n.language !== typedUser.language) {
      i18n.changeLanguage(typedUser.language);
    }
  }, [typedUser?.language, i18n]);
}
