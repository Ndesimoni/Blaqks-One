/**
 * Pure translation lookup (docs/i18n.md). Keys are `namespace.key`, such as
 * `profile.language.title`: the first segment names the catalogue file. Values are strings
 * with `{name}` placeholders, or plural objects keyed by `Intl.PluralRules` categories and
 * chosen by `vars.count`. A missing Arabic key falls back to English with a development
 * warning; a key missing everywhere renders as an empty string, never as the raw key.
 */
import { DEFAULT_LANGUAGE, LANGUAGES } from './languages.js';

const PLACEHOLDER = /\{(\w+)\}/g;
const pluralRules = new Map();
const numberFormats = new Map();
const warned = new Set();

const cached = (cache, locale, create) => {
  if (!cache.has(locale)) cache.set(locale, create(locale));
  return cache.get(locale);
};

/** The catalogue entry for `key` in `language`, or undefined. */
export function lookup(catalogs, language, key) {
  const split = typeof key === 'string' ? key.indexOf('.') : -1;
  if (split < 1) return undefined;
  const namespace = catalogs[language]?.[key.slice(0, split)];
  const value = namespace && Object.hasOwn(namespace, key.slice(split + 1));
  return value ? namespace[key.slice(split + 1)] : undefined;
}

/** The plural form for `count`; a missing category uses `other`. */
export function pluralForm(entry, locale, count) {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return undefined;
  const rules = cached(pluralRules, locale, (value) => new Intl.PluralRules(value));
  const category = Number.isFinite(count) ? rules.select(count) : 'other';
  return entry[category] ?? entry.other;
}

/** Replaces `{name}` with `vars.name`; numbers use the language's digits and grouping. */
export function interpolate(text, vars, locale) {
  if (!vars) return text;
  return text.replace(PLACEHOLDER, (_, name) => {
    const value = vars[name];
    if (value === undefined || value === null) return '';
    if (typeof value === 'number')
      return cached(numberFormats, locale, (code) => new Intl.NumberFormat(code)).format(value);
    return String(value);
  });
}

function devWarning(message, env) {
  if (!env?.DEV || warned.has(message)) return;
  warned.add(message);
  console.warn(`[i18n] ${message}`);
}

/**
 * `t(key, vars)` for `language`. `env` defaults to Vite's, so warnings appear only in
 * development builds.
 */
export function createTranslator(language, catalogs, env = import.meta.env) {
  const { locale } = LANGUAGES[language] ?? LANGUAGES[DEFAULT_LANGUAGE];
  const fallbackLocale = LANGUAGES[DEFAULT_LANGUAGE].locale;
  return function t(key, vars) {
    let entry = lookup(catalogs, language, key);
    let entryLocale = locale;
    if (entry === undefined && language !== DEFAULT_LANGUAGE) {
      devWarning(`Missing ${language} text for "${key}"; showing English.`, env);
      entry = lookup(catalogs, DEFAULT_LANGUAGE, key);
      entryLocale = fallbackLocale;
    }
    const text = pluralForm(entry, entryLocale, vars?.count);
    if (typeof text !== 'string') {
      devWarning(`Missing text for "${key}".`, env);
      return '';
    }
    return interpolate(text, vars, locale);
  };
}
