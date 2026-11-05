'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';

export function EnquiryForm({
  listingId,
  agentId,
  companyId,
}: {
  listingId?: string;
  agentId?: string;
  companyId?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [received, setReceived] = useState(false);
  const submission = useRef({ body: '', key: '' });
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || received) return;
    const form = new FormData(event.currentTarget);
    const body = JSON.stringify({
      listingId,
      agentId,
      companyId,
      name: form.get('name'),
      email: form.get('email') || undefined,
      phone: form.get('phone') || undefined,
      message: form.get('message'),
      contactPreference: form.get('contactPreference') || undefined,
      privacyAcknowledged: form.get('privacy') === 'on',
    });
    if (submission.current.body !== body) submission.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': submission.current.key },
        body,
      });
      const result = await response.json().catch(() => ({
        message: 'The enquiry service is temporarily unavailable. Please try again.',
      }));
      if (!response.ok || result.status !== 'received')
        throw Error(result.message || 'The enquiry could not be saved.');
      setReceived(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  if (received)
    return (
      <div className="enquiry-received" role="status">
        <h2>Your enquiry has been received.</h2>
        <p>The company representing this property or profile can now follow up with you.</p>
        <Link href="/properties">Continue exploring properties →</Link>
      </div>
    );
  return (
    <form className="public-enquiry-form" method="post" action="/api/enquiries" onSubmit={submit}>
      <h2>Tell us what you’re looking for.</h2>
      <noscript>
        Enable JavaScript to submit this form, or use the representative’s contact links.
      </noscript>
      <label>
        Your name
        <input name="name" autoComplete="name" maxLength={100} required />
      </label>
      <div className="field-pair">
        <label>
          Email
          <input name="email" type="email" autoComplete="email" maxLength={254} />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" autoComplete="tel" placeholder="+971…" maxLength={16} />
        </label>
      </div>
      <p className="muted">Provide an email address or international phone number.</p>
      <label>
        Preferred contact method
        <select name="contactPreference">
          <option value="">No preference</option>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </label>
      <label>
        Your message
        <textarea name="message" rows={5} maxLength={4000} required />
      </label>
      <label className="privacy-choice">
        <input name="privacy" type="checkbox" required />
        <span>
          I have read the <Link href="/privacy">privacy notice</Link> and agree to be contacted
          about this enquiry.
        </span>
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={busy} type="submit">
        {busy ? 'Saving enquiry…' : 'Send enquiry →'}
      </button>
    </form>
  );
}
