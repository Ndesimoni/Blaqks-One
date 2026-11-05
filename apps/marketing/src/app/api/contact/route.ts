import { checkMessage, type ContactMessage } from '@/lib/contact-message';
import { intakeBody, intakeUrl } from '@/lib/crm-intake';

const reply = (body: object, status: number) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** The browser's origin must be this site, as the property website's enquiry relay checks. */
function sameOrigin(request: Request) {
  try {
    const origin = new URL(request.headers.get('origin') || '');
    return origin.host.toLowerCase() === request.headers.get('host')?.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * The contact form. A message becomes a new client in Blaqks One's own clients (BO1e)
 * through the CRM's public intake, server to server, without cookies or the visitor's
 * proxy headers. Until BLAQKS_ONE_API_ORIGIN is set the form says plainly that sending is
 * not switched on, and keeps nothing.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ message: 'Send the form from this website.' }, 403);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return reply({ message: 'Send the form again.' }, 400);
  }
  const problems = checkMessage(body);
  if (Object.keys(problems).length) return reply({ problems }, 400);
  const target = intakeUrl();
  if (!target)
    return reply(
      { message: 'Messages cannot be sent from this form yet. Please try again soon.' },
      503,
    );
  const fields = ['name', 'company', 'email', 'mobile', 'teamSize', 'message'] as const;
  const message = Object.fromEntries(
    fields.map((key) => [key, String(body[key] ?? '').trim()]),
  ) as ContactMessage;
  const honeypot = typeof body.website === 'string' ? body.website : '';
  const sent = await fetch(target, {
    method: 'POST',
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(intakeBody(message, honeypot)),
  }).catch(() => null);
  if (!sent?.ok)
    return reply({ message: 'We could not send your message. Please try again.' }, 502);
  return reply({ sent: true }, 200);
}
