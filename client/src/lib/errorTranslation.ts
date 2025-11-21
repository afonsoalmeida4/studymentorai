import { TFunction } from 'i18next';

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
