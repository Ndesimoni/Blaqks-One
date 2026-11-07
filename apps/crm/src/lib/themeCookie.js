/**
 * The theme shared with the Blaqks One website (owner, 2026-11-05: one colour everywhere, and
 * a change on either side applies to both). A cookie, because the two sites have separate
 * storage: on one computer they share `localhost`; in production set VITE_THEME_COOKIE_DOMAIN
 * to the parent domain (for example `.blaqksone.com`). The website reads and writes the same
 * cookie (apps/marketing/src/lib/theme.ts).
 */
const NAME = 'b1-theme';
const YEAR = 60 * 60 * 24 * 365;

/** 'light' or 'dark' when a choice was made on either site, else null. */
export function readThemeCookie(doc = globalThis.document) {
  const match = doc?.cookie?.match(/(?:^|;\s*)b1-theme=(light|dark)(?:;|$)/);
  return match ? match[1] : null;
}

export function writeThemeCookie(theme, doc = globalThis.document, env = import.meta.env) {
  if (!doc || (theme !== 'light' && theme !== 'dark')) return;
  const domain = env?.VITE_THEME_COOKIE_DOMAIN?.trim();
  doc.cookie = `${NAME}=${theme}; Path=/; Max-Age=${YEAR}; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`;
}
