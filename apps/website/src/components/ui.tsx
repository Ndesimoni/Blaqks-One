import Link from 'next/link';
import type { Agent, Listing, Query } from '../lib/types';

export const first = (value: Query[string]) =>
  Array.isArray(value) ? value[0] || '' : value || '';
export const money = (listing: Listing) =>
  `AED ${listing.price.toLocaleString('en-AE')}${listing.purpose === 'rent' ? ' / year' : listing.purpose === 'holiday' ? ' / night' : ''}`;
export const count = (value: number, unit: string) =>
  `${value.toLocaleString('en-AE')} ${unit}${value === 1 ? '' : 's'}`;
export const bedrooms = (listing: Listing, commercial = 'Commercial') =>
  listing.bedrooms === null
    ? commercial
    : listing.bedrooms === 0
      ? 'Studio'
      : count(listing.bedrooms, 'bed');
export const initials = (name: string) =>
  name
    .split(' ')
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0])
    .join('');
export function queryHref(query: Query, updates: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...updates })) {
    for (const item of Array.isArray(value) ? value : [value]) if (item) params.append(key, item);
  }
  return `/properties?${params}`;
}
export function Heading({
  eyebrow,
  title,
  text,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="page-heading">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {text && <p className="muted">{text}</p>}
    </div>
  );
}
export function Empty({
  title = 'No matching properties.',
  text = 'Try another area or remove a filter.',
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p className="muted">{text}</p>
      <Link className="button quiet" href="/properties">
        Browse all properties →
      </Link>
    </div>
  );
}
export function ContactLinks({ agent, listing }: { agent?: Agent; listing?: Listing }) {
  if (!agent || (listing && agent.id !== listing.agent)) return null;
  const message = listing
    ? `Hi ${agent.name}, I am interested in ${listing.title} (${listing.reference}). Could you share more details?`
    : `Hi ${agent.name}, I would like to discuss my property requirements.`;
  const subject = listing
    ? `Property enquiry: ${listing.reference}`
    : `Property enquiry for ${agent.name}`;
  return (
    <div className="contact-links">
      {/^\+[1-9]\d{7,14}$/.test(agent.publicWhatsApp || '') && (
        <a
          href={`https://wa.me/${agent.publicWhatsApp!.slice(1)}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp <span className="sr-only">{agent.name} (opens in a new tab)</span>
          <span aria-hidden="true">→</span>
        </a>
      )}
      {/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(agent.publicEmail || '') && (
        <a
          href={`mailto:${agent.publicEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}
        >
          Email <span className="sr-only">{agent.name}</span>
          <span aria-hidden="true">→</span>
        </a>
      )}
    </div>
  );
}
export function Pagination({
  page,
  pages,
  href,
  label,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
  label: string;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label={label}>
      {page > 1 && <Link href={href(page - 1)}>← Previous</Link>}
      <span>
        Page {page} of {pages}
      </span>
      {page < pages && <Link href={href(page + 1)}>Next →</Link>}
    </nav>
  );
}
