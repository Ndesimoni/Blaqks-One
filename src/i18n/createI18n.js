/**
 * The value `useI18n()` returns for one language, without React (docs/i18n.md):
 * `t(key, vars)`, the language code, its locale and direction, formatters and the
 * languages a member may choose. The provider adds `setLanguage`.
 */
import { catalogs as allCatalogs } from './catalogs/index.js';
import { createFormatters } from './format.js';
import { availableLanguages, DEFAULT_LANGUAGE, LANGUAGES } from './languages.js';
import { createTranslator } from './translate.js';

export function createI18n(language, { catalogs = allCatalogs, preview, env } = {}) {
  const config = LANGUAGES[language] ?? LANGUAGES[DEFAULT_LANGUAGE];
  return {
    language: config.code,
    locale: config.locale,
    dir: config.dir,
    t: createTranslator(config.code, catalogs, env),
    format: createFormatters(config.code),
    languages: availableLanguages(preview),
  };
}

/** Applies a language to the document root so CSS `:lang()` and `dir` rules follow it. */
export function applyDocumentLanguage(root, language) {
  const config = LANGUAGES[language] ?? LANGUAGES[DEFAULT_LANGUAGE];
  if (!root) return;
  root.lang = config.code;
  root.dir = config.dir;
}
