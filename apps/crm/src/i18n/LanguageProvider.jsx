import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { applyDocumentLanguage, createI18n } from './createI18n.js';
import { LanguageContext } from './LanguageContext.js';
import { effectiveLanguage, isLanguage, readSavedLanguage, saveLanguage } from './languages.js';

/**
 * Holds the interface language (docs/i18n.md). It starts from this browser's saved choice,
 * or English, and sets `<html lang dir>`. Connected mode passes the member's server
 * preference to `setLanguage` after sign-in. Preview languages apply only when
 * `VITE_I18N_PREVIEW=true`; otherwise English is shown whatever was saved.
 */
export function LanguageProvider({ children }) {
  const [choice, setChoice] = useState(readSavedLanguage);
  const language = effectiveLanguage(choice);
  const setLanguage = useCallback((code) => {
    if (!isLanguage(code)) return;
    saveLanguage(code);
    setChoice(code);
  }, []);
  useLayoutEffect(() => applyDocumentLanguage(document.documentElement, language), [language]);
  const value = useMemo(() => ({ ...createI18n(language), setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
