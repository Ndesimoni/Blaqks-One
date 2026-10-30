import { get } from '../../../lib/records.js';

/** Pure helpers for the new-contact review panels (plan U2). */

/** The sender's own words, as notes a person checks before the lead is saved. */
export function draftNotes(messages = []) {
  return messages
    .filter((message) => message.direction === 'inbound' && message.body)
    .slice(0, 3)
    .map((message) => message.body.trim())
    .join('\n')
    .slice(0, 2000);
}

const LIMIT = 30;

/** Clients and Contacts this session can see, matched on name, ID, phone or email. */
export function linkCandidates(entries, query) {
  const words = String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const rows = ['Clients', 'Contacts'].flatMap((collection) =>
    (entries?.[collection] || []).map((entry) => ({
      collection,
      id: entry.id,
      name: get(entry.record, 'Full name') || '',
      legacy: get(entry.record, collection === 'Clients' ? 'Client ID' : 'Contact ID') || '',
      phone: get(entry.record, 'Phone') || '',
      email: get(entry.record, 'Email') || '',
    })),
  );
  if (!words.length) return rows.slice(0, LIMIT);
  return rows
    .filter((row) => {
      const text = [row.name, row.legacy, row.phone, row.email].join(' ').toLowerCase();
      return words.every((word) => text.includes(word));
    })
    .slice(0, LIMIT);
}
