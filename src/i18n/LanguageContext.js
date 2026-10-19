import { createContext } from 'react';
import { createI18n } from './createI18n.js';

/** English until a `LanguageProvider` is mounted, so shared components never break. */
export const LanguageContext = createContext({ ...createI18n('en'), setLanguage: () => {} });
