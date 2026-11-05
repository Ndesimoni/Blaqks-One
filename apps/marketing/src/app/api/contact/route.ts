import { checkMessage } from '@/lib/contact-message';

/**
 * The contact form. Messages go to CONTACT_WEBHOOK_URL when it is set (the team's inbox or
 * CRM); until then the form says plainly that sending is not switched on, and keeps nothing.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: 'Send the form again.' }, { status: 400 });
  }
  const problems = checkMessage(body);
  if (Object.keys(problems).length) return Response.json({ problems }, { status: 400 });
  const target = process.env.CONTACT_WEBHOOK_URL;
  if (!target)
    return Response.json(
      { message: 'Messages cannot be sent from this form yet. Please try again soon.' },
      { status: 503 },
    );
  const fields = ['name', 'company', 'email', 'mobile', 'teamSize', 'message'] as const;
  const message = Object.fromEntries(fields.map((key) => [key, String(body[key] ?? '').trim()]));
  const sent = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'blaqks-one-website', ...message }),
  }).catch(() => null);
  if (!sent?.ok)
    return Response.json(
      { message: 'We could not send your message. Please try again.' },
      { status: 502 },
    );
  return Response.json({ sent: true });
}
