/**
 * Interface languages (docs/i18n.md). English is the default and the fallback. Arabic uses
 * Western digits (`-u-nu-latn`) so prices, unit numbers and phone numbers stay unambiguous.
 * Until the translation pass, Arabic is offered only when `VITE_I18N_PREVIEW=true`.
 */
import { LANGUAGE } from '../config/storage.js';

export const DEFAULT_LANGUAGE = 'en';

export const LANGUAGES = Object.freeze({
  en: Object.freeze({ code: 'en', name: 'English', locale: 'en-AE', dir: 'ltr', preview: false }),
  ar: Object.freeze({
    code: 'ar',
    name: 'العربية',
    locale: 'ar-AE-u-nu-latn',
    dir: 'rtl',
    preview: true,
  }),
});

export const isLanguage = (code) => Object.hasOwn(LANGUAGES, code);

/** The build-time preview switch; false outside Vite (unit tests) unless passed in. */
export const previewEnabled = (env = import.meta.env) => env?.VITE_I18N_PREVIEW === 'true';

/** Languages a member may choose: English only, plus every preview language when enabled. */
export const availableLanguages = (preview = previewEnabled()) =>
  Object.values(LANGUAGES)
    .filter((language) => preview || !language.preview)
    .map((language) => language.code);

/** The language actually shown: an unknown or unavailable choice falls back to English. */
export const effectiveLanguage = (code, preview = previewEnabled()) =>
  isLanguage(code) && availableLanguages(preview).includes(code) ? code : DEFAULT_LANGUAGE;

/** This browser's saved choice (sign-in screen and demo), or English. Never throws. */
export function readSavedLanguage(storage) {
  try {
    const saved = (storage === undefined ? globalThis.localStorage : storage)?.getItem(LANGUAGE);
    return isLanguage(saved) ? saved : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/** Saves this browser's choice; storage may be unavailable (private windows), so it never throws. */
export function saveLanguage(code, storage) {
  if (!isLanguage(code)) return;
  try {
    (storage === undefined ? globalThis.localStorage : storage)?.setItem(LANGUAGE, code);
  } catch {
    // The choice still applies for this visit.
  }
}
