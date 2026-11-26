export function crmEntry(value = process.env.WEBSITE_CRM_URL): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    return url.href;
  } catch {
    return null;
  }
}
