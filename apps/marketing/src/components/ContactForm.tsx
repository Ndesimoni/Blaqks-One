'use client';
import { useState } from 'react';
import { type ContactMessage, teamSizes } from '@/lib/contact-message';
import { Arrow } from './Arrow';

type Problems = Partial<Record<keyof ContactMessage, string>>;
const empty: ContactMessage = {
  name: '',
  company: '',
  email: '',
  mobile: '',
  teamSize: teamSizes[0],
  message: '',
};

/** Talk to us: checked on the server, with each problem shown beside its field. */
export function ContactForm() {
  const [form, setForm] = useState(empty);
  const [problems, setProblems] = useState<Problems>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  // A trap field people never see; bots fill it, and the CRM then stores nothing.
  const [website, setWebsite] = useState('');
  const set =
    (key: keyof ContactMessage) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: event.target.value });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState('sending');
    setError('');
    const reply = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, website }),
    }).catch(() => null);
    const body = reply ? await reply.json().catch(() => ({})) : {};
    if (reply?.ok) return setState('sent');
    setState('idle');
    setProblems(body.problems || {});
    setError(
      body.message || (body.problems ? '' : 'We could not send your message. Please try again.'),
    );
  };
  if (state === 'sent')
    return (
      <div className="contact-form sent" role="status">
        <h2 style={{ fontSize: 26 }}>Thank you</h2>
        <p style={{ color: 'var(--text-2)' }}>
          We have your message and will reply by email within one working day.
        </p>
        <button
          type="button"
          className="btn btn-dark"
          onClick={() => (setForm(empty), setState('idle'))}
        >
          Send another message
        </button>
      </div>
    );
  const field = (key: keyof ContactMessage, label: string, input: React.ReactElement) => (
    <label className="field" htmlFor={`contact-${key}`}>
      {label}
      {input}
      {problems[key] && (
        <span className="field-error" id={`contact-${key}-error`}>
          {problems[key]}
        </span>
      )}
    </label>
  );
  const props = (key: keyof ContactMessage) => ({
    id: `contact-${key}`,
    value: form[key],
    onChange: set(key),
    'aria-invalid': Boolean(problems[key]),
    'aria-describedby': problems[key] ? `contact-${key}-error` : undefined,
  });
  return (
    <form className="contact-form" onSubmit={submit} noValidate>
      <div className="two">
        {field('name', 'Full name', <input autoComplete="name" {...props('name')} />)}
        {field('company', 'Company', <input autoComplete="organization" {...props('company')} />)}
      </div>
      <div className="two">
        {field(
          'email',
          'Work email',
          <input type="email" autoComplete="email" {...props('email')} />,
        )}
        {field(
          'mobile',
          'Mobile (optional)',
          <input
            type="tel"
            autoComplete="tel"
            placeholder="+971 50 123 4567"
            {...props('mobile')}
          />,
        )}
      </div>
      {field(
        'teamSize',
        'Team size',
        <select {...props('teamSize')}>
          {teamSizes.map((size) => (
            <option key={size}>{size}</option>
          ))}
        </select>,
      )}
      {field('message', 'How can we help?', <textarea {...props('message')} />)}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-10000px', width: 1, height: 1 }}
      />
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-gold" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send message'} <Arrow />
      </button>
    </form>
  );
}
