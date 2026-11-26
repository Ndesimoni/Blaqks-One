import { useEffect } from 'react';
import { useI18n } from '../../i18n/useI18n.js';

/**
 * Adopts the signed-in member's server language preference (docs/i18n.md). It is also
 * saved in this browser, so the sign-in screen opens in the same language next time.
 * Signing out keeps the browser's choice.
 */
export function useAccountLanguage(language) {
  const { setLanguage } = useI18n();
  useEffect(() => {
    if (language) setLanguage(language);
  }, [language, setLanguage]);
}
