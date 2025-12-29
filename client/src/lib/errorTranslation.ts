import { TFunction } from 'i18next';

// Map Supabase error messages to translation keys
const supabaseErrorMap: Record<string, string> = {
  'Email not confirmed': 'auth.emailNotConfirmed',
  'Invalid login credentials': 'auth.invalidCredentials',
  'User already registered': 'auth.userAlreadyExists',
  'Password should be at least 6 characters': 'auth.passwordTooShort',
  'Unable to validate email address: invalid format': 'auth.invalidEmailFormat',
  'Email rate limit exceeded': 'auth.rateLimitExceeded',
  'For security purposes, you can only request this once every 60 seconds': 'auth.rateLimitExceeded',
};

/**
 * Translates Supabase auth error messages
 */
export function translateSupabaseError(t: TFunction, errorMessage: string): string {
  const translationKey = supabaseErrorMap[errorMessage];
  if (translationKey) {
    const translated = t(translationKey);
    if (translated !== translationKey) {
      return translated;
    }
  }
  return errorMessage;
}

/**
 * Translates error messages from the backend using errorCode and params
 */
export function translateError(t: TFunction, errorData: any): string {
  // If errorCode exists, use it for translation
  if (errorData.errorCode && t(`errors.${errorData.errorCode}`) !== `errors.${errorData.errorCode}`) {
    return String(t(`errors.${errorData.errorCode}`, errorData.params || {}));
  }
  
  // Fallback to the error message if no errorCode or translation not found
  if (errorData.error) {
    return String(errorData.error);
  }
  
  // Final fallback to generic error
  return String(t('errors.generic'));
}
