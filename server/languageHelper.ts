import { supportedLanguages, type SupportedLanguage } from "@shared/schema";

/**
 * Normalizes and validates a language code to a supported language.
 * Handles various formats (pt, pt-BR, en-US, etc.) and defaults to Portuguese.
 * 
 * @param language - The language code to normalize (can be from user profile, request, or frontend)
 * @param fallback - The fallback language if normalization fails (defaults to "pt")
 * @returns A validated SupportedLanguage code
 */
export function normalizeLanguage(language: string | null | undefined, fallback: SupportedLanguage = "pt"): SupportedLanguage {
  if (!language) {
    return fallback;
  }

  // Normalize to lowercase and extract base language code (e.g., "pt-BR" -> "pt")
  const baseLanguage = language.toLowerCase().split("-")[0].trim();

  // Check if the base language is supported
  if (supportedLanguages.includes(baseLanguage as SupportedLanguage)) {
    return baseLanguage as SupportedLanguage;
  }

  // Log unsupported language attempts for monitoring
  console.warn(`[LanguageHelper] Unsupported language code: ${language}, falling back to ${fallback}`);
  
  return fallback;
}

/**
 * Gets a safe language from a user object, with fallback handling
 * 
 * @param userLanguage - The language from the user profile (can be null/undefined)
 * @param requestLanguage - Optional language from request (e.g., Accept-Language header)
 * @returns A validated SupportedLanguage code
 */
export function getUserLanguage(
  userLanguage: string | null | undefined,
  requestLanguage?: string | null | undefined
): SupportedLanguage {
  // Try user profile language first
  if (userLanguage) {
    const normalized = normalizeLanguage(userLanguage, "pt");
    if (normalized !== "pt" || userLanguage.startsWith("pt")) {
      return normalized;
    }
  }

  // Fall back to request language if available
  if (requestLanguage) {
    return normalizeLanguage(requestLanguage, "pt");
  }

  // Final fallback to Portuguese
  return "pt";
}
