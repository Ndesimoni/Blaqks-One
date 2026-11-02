import { get } from '../../../lib/records.js';
import { findEntry } from '../assignment/assignmentModel.js';
import { plainEmail } from './composerModel.js';
import { canReplyOn } from './inboxModel.js';

/**
 * Records whose slider offers ways to contact their person (owner, 2026-11-02): a client or
 * contact itself, and the records linked to a client.
 */
export const contactModules = [
  'Clients',
  'Contacts',
  'Interaction log',
  'Follow-ups',
  'Viewings',
  'Client care',
  'Shortlist',
];

/**
 * A phone as international digits without "+" or "00" (WhatsApp click-to-chat, `tel:`); a UAE
 * local number (05…) gains 971. '' when it cannot be a full number (8 to 15 digits).
 */
export function phoneDigits(phone) {
  let digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `971${digits.slice(1)}`;
  return /^\d{8,15}$/.test(digits) ? digits : '';
}

/**
 * How a record's slider may contact its person: a contact is itself; any other record means its
 * client. `person` is the new email's recipient row; Call needs a full number; Email a plain
 * address and the member's email grant; WhatsApp the WhatsApp grant. Nothing for a person the
 * caller does not hold in full, such as a kept copy after a hand-over (agreements design §18).
 */
export function contactOptions({ module, record, entries, keptFor, user }) {
  const none = { person: null, call: '', email: false, whatsapp: '' };
  if (!contactModules.includes(module)) return none;
  const collection = module === 'Contacts' ? 'Contacts' : 'Clients';
  const field = collection === 'Contacts' ? 'Contact ID' : 'Client ID';
  const key = collection === 'Contacts' ? 'contact_id' : 'client_id';
  const legacy = String(get(record, field) ?? '').trim();
  const entry = legacy ? findEntry(entries || {}, collection, { [key]: legacy }) : null;
  if (!entry || keptFor?.(collection, entry.record)) return none;
  const person = {
    collection,
    id: entry.id,
    name: get(entry.record, 'Full name') || '',
    legacy,
    phone: get(entry.record, 'Phone') || '',
    email: get(entry.record, 'Email') || '',
  };
  const digits = phoneDigits(person.phone);
  return {
    person,
    call: digits,
    email: canReplyOn(user, 'email') && plainEmail(person.email),
    whatsapp: canReplyOn(user, 'whatsapp') ? digits : '',
  };
}

/**
 * The person's most recent conversation among `rows` (an inbox list page, newest activity
 * first) linked to their record, or ''. Spam is left out.
 */
export function linkedConversation(rows, person) {
  const row = (rows || []).find(
    (conversation) =>
      conversation.state !== 'spam' &&
      conversation.linked?.collection === person.collection &&
      conversation.linked?.recordId === person.id,
  );
  return row?.id || '';
}
