/**
 * The theme shared with the CRM (owner, 2026-11-05: one colour everywhere; a change on either
 * side applies to both). Kept in the `b1-theme` cookie, which the CRM reads and writes too
 * (apps/crm/src/lib/themeCookie.js). Both start dark. In production set
 * NEXT_PUBLIC_THEME_COOKIE_DOMAIN to the parent domain, for example `.blaqksone.com`.
 */
export type Theme = 'light' | 'dark';

const YEAR = 60 * 60 * 24 * 365;

export function readTheme(cookie: string): Theme | null {
  const match = cookie.match(/(?:^|;\s*)b1-theme=(light|dark)(?:;|$)/);
  return match ? (match[1] as Theme) : null;
}

export function themeCookie(theme: Theme, domain = process.env.NEXT_PUBLIC_THEME_COOKIE_DOMAIN) {
  const scope = domain?.trim() ? `; Domain=${domain.trim()}` : '';
  return `b1-theme=${theme}; Path=/; Max-Age=${YEAR}; SameSite=Lax${scope}`;
}

/** Runs before the page draws, so it opens in the shared theme without a flash. */
export const themeScript = `try{var m=document.cookie.match(/(?:^|;\\s*)b1-theme=(light|dark)(?:;|$)/);document.documentElement.dataset.theme=m?m[1]:'dark'}catch(e){}`;
