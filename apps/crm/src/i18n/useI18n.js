import { useContext } from 'react';
import { LanguageContext } from './LanguageContext.js';

/**
 * `{ t, language, locale, dir, format, languages, setLanguage }` for the current language.
 * See docs/i18n.md for keys, plurals and formatters.
 */
export const useI18n = () => useContext(LanguageContext);
