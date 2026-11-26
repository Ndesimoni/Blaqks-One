import { currentSite } from '@/lib/site';
import { publicApiOrigin } from '@/lib/api-origin';
import { readPublicBody } from '@/lib/public-response';

export async function POST(request: Request) {
  const reply = (body: object, status: number) =>
    Response.json(body, {
      status,
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  try {
    const origin = new URL(request.headers.get('origin') || '');
    if (
      !['https:', 'http:'].includes(origin.protocol) ||
      origin.host.toLowerCase() !== request.headers.get('host')?.toLowerCase() ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      origin.pathname !== '/'
    )
      throw Error('Origin mismatch');
  } catch {
    return reply({ message: 'Submit the enquiry from this website.' }, 403);
  }
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return reply({ message: 'Provide a valid enquiry.' }, 400);
  const key = request.headers.get('idempotency-key') || '';
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(key))
    return reply({ message: 'Provide a valid submission key.' }, 400);
  let body: string;
  try {
    body = await readPublicBody(new Response(request.body, { headers: request.headers }), 16384);
    JSON.parse(body);
  } catch {
    return reply({ message: 'The enquiry is invalid or too large.' }, 400);
  }
  const { site, host } = await currentSite();
  if (site.sample) return reply({ message: 'Sample enquiries are not sent or saved.' }, 400);
  try {
    const url = new URL(
      `/api/public/v1/sites/${encodeURIComponent(site.id)}/enquiries`,
      publicApiOrigin(),
    );
    url.searchParams.set('host', host);
    // Never forward CRM cookies or visitor-supplied client-IP/proxy headers.
    const result = await fetch(url, {
      method: 'POST',
      body,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': key,
      },
    });
    const payload = JSON.parse(await readPublicBody(result, 16384));
    if (
      [200, 201].includes(result.status) &&
      /^[0-9a-f-]{36}$/i.test(payload.receipt) &&
      payload.status === 'received'
    )
      return reply({ receipt: payload.receipt, status: 'received' }, result.status);
    const status = [400, 403, 404, 409, 413, 429, 503].includes(result.status)
      ? result.status
      : 503;
    return reply(
      {
        message:
          typeof payload.message === 'string' && payload.message.length < 500
            ? payload.message
            : 'The enquiry could not be saved. Please try again.',
      },
      status,
    );
  } catch {
    return reply(
      { message: 'The enquiry service is temporarily unavailable. Retry using the same details.' },
      503,
    );
  }
}
