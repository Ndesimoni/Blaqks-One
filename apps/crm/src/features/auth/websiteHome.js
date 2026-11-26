/**
 * The Blaqks One website's home page (VITE_WEBSITE_URL), where signing out leads and where
 * the account pages' Back link goes (owner, 2026-11-05). Empty when no website is set up:
 * signing out then opens the sign-in page.
 */
export const websiteHome = (env = import.meta.env) => env?.VITE_WEBSITE_URL?.trim() || '';
