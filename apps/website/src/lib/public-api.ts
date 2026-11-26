import 'server-only';
import { object } from './public-shapes.ts';
import { readPublicBody } from './public-response.ts';
import { publicApiOrigin } from './api-origin.ts';

export class PublicUnavailable extends Error {}
export class PublicNotFound extends Error {}

export async function publicGet(
  path: string,
  host: string,
  query = new URLSearchParams(),
): Promise<Record<string, unknown>> {
  let base: URL;
  try {
    base = publicApiOrigin();
  } catch {
    throw new PublicUnavailable('The public catalogue is not configured.');
  }
  const url = new URL(`/api/public/v1/${path}`, base);
  query.set('host', host);
  url.search = query.toString();
  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new PublicUnavailable('The public catalogue could not be reached.');
  }
  if (response.status === 404) throw new PublicNotFound('Public content not found.');
  if (!response.ok) throw new PublicUnavailable('The public catalogue is temporarily unavailable.');
  try {
    const body = await readPublicBody(response);
    return object(JSON.parse(body));
  } catch {
    throw new PublicUnavailable('The public catalogue returned an invalid response.');
  }
}
