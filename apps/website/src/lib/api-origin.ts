import 'server-only';

export function publicApiOrigin(): URL {
  const origin = process.env.WEBSITE_API_ORIGIN;
  if (!origin) throw Error('The public API is not configured.');
  const base = new URL(origin);
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/')
    throw Error('Invalid public API origin.');
  if (
    base.protocol !== 'https:' &&
    !(base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname))
  )
    throw Error('The public API requires HTTPS.');
  return base;
}
