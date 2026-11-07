import type { ContactMessage } from './contact-message';

/**
 * Where contact messages go (BO1e, docs/blaqks-one-console.md §9): the Blaqks One CRM's
 * public intake, which adds the sender to Blaqks One's own clients as a new client from the
 * website form. BLAQKS_ONE_API_ORIGIN is the CRM API's origin (HTTPS, or local http).
 */
export function intakeUrl(): URL | null {
  const origin = process.env.BLAQKS_ONE_API_ORIGIN;
  if (!origin) return null;
  const base = new URL(origin);
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/')
    throw Error('Invalid BLAQKS_ONE_API_ORIGIN.');
  const local = base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname);
  if (base.protocol !== 'https:' && !local) throw Error('BLAQKS_ONE_API_ORIGIN must use HTTPS.');
  return new URL('/api/public/blaqks-one/contact', base);
}

/** A mobile number in international form (+971501234567), or '' when it cannot be one. */
export function internationalPhone(value: string): string {
  const digits = value.replace(/[\s()-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : '';
}

/** The intake body: the team size leads the message; `website` is the form's honeypot. */
export function intakeBody(message: ContactMessage, honeypot: string) {
  return {
    name: message.name,
    company: message.company,
    email: message.email,
    phone: internationalPhone(message.mobile),
    message: `Team size: ${message.teamSize}\n\n${message.message}`,
    website: honeypot,
  };
}
