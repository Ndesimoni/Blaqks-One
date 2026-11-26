import { plainEmail } from '../inbox/composerModel.js';
import { phoneDigits } from '../inbox/contactModel.js';

/**
 * Blaqks One's own sales clients (BO1e, docs/blaqks-one-console.md §9): the stages in order,
 * where a client came from, what can be logged, and the list's filters. Lost leaves the
 * pipeline, so it has no next stage and the stage track shows it apart.
 */
export const STAGES = ['new', 'contacted', 'demo_booked', 'signed_up', 'customer', 'lost'];
export const PIPELINE = STAGES.filter((stage) => stage !== 'lost');
export const SOURCES = ['website_form', 'help_request', 'referral', 'call', 'other'];
/** What a team member logs by hand; the server adds created, stage, linked and assigned. */
export const LOG_KINDS = ['call', 'whatsapp', 'email', 'sms', 'note'];
export const TIMELINE_KINDS = [...LOG_KINDS, 'created', 'stage', 'linked', 'assigned'];
/** The Assigned filter: Everyone, Mine, Unassigned. */
export const OWNER_FILTERS = ['all', 'me', 'unassigned'];
/** The grid's presets: All clients, then one per stage. */
export const PRESETS = ['all', ...STAGES];

const TONES = {
  new: 'slate',
  contacted: 'amber',
  demo_booked: 'amber',
  signed_up: 'green',
  customer: 'green',
  lost: 'red',
};
export const stageTone = (stage) => TONES[stage] || 'slate';

/** The stage after `stage` in the pipeline, or null at Customer, at Lost or when unknown. */
export function nextStage(stage) {
  const at = PIPELINE.indexOf(stage);
  return at >= 0 && at < PIPELINE.length - 1 ? PIPELINE[at + 1] : null;
}

/** The list request for a view; unknown choices fall back to all clients and everyone. */
export function listParams({ stage = 'all', query = '', owner = 'all' } = {}, cursor = null) {
  const params = {
    stage: PRESETS.includes(stage) ? stage : 'all',
    owner: OWNER_FILTERS.includes(owner) ? owner : 'all',
  };
  const q = String(query).trim().slice(0, 100);
  if (q) params.q = q;
  if (cursor) params.cursor = cursor;
  return params;
}

/** The total the footer shows: every stage for All clients, else the preset's own count. */
export function presetTotal(counts, stage) {
  if (!counts) return null;
  if (stage !== 'all') return counts[stage] ?? 0;
  return STAGES.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
}

/**
 * Links that open the phone's own apps (as the CRM's Call button does): Call and Text need a
 * full number (a UAE 05… number gains 971), WhatsApp opens its click-to-chat page, Email
 * needs a plain address. A link that cannot work is ''.
 */
export function contactLinks({ phone, email } = {}) {
  const digits = phoneDigits(phone);
  const address = String(email ?? '').trim();
  return {
    call: digits ? `tel:+${digits}` : '',
    whatsapp: digits ? `https://wa.me/${digits}` : '',
    email: plainEmail(address) ? `mailto:${address}` : '',
    sms: digits ? `sms:+${digits}` : '',
  };
}

export const blankClient = () => ({
  companyName: '',
  contactName: '',
  phone: '',
  email: '',
  source: 'other',
  stage: 'new',
  notes: '',
  nextFollowUp: '',
  ownerId: '',
});

/** The edit form's values for a saved client. */
export const formFrom = (client) =>
  Object.fromEntries(
    Object.keys(blankClient()).map((key) => [key, client?.[key] ?? blankClient()[key]]),
  );

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The server keeps phones in international form: "+" then 7 to 15 digits. */
const INTERNATIONAL = /^\+\d{7,15}$/;

/** How a client is named in lists and messages: the company, else the contact. */
export const clientName = (client) => client.companyName || client.contactName;

/** The first problem with the form, as a `platformClients` key, or ''. */
export function clientError(form) {
  if (!form.companyName.trim() && !form.contactName.trim()) return 'error.names';
  if (!form.phone.trim() && !form.email.trim()) return 'error.reach';
  if (form.phone.trim() && !INTERNATIONAL.test(form.phone.replace(/[\s()-]/g, '')))
    return 'error.phone';
  if (form.email.trim() && !plainEmail(form.email.trim())) return 'error.email';
  if (!SOURCES.includes(form.source) || !STAGES.includes(form.stage)) return 'error.choice';
  if (form.nextFollowUp && !DAY.test(form.nextFollowUp)) return 'error.date';
  return '';
}

/** The body the API takes: trimmed text, no follow-up or owner as null. */
export function clientBody(form) {
  return {
    companyName: form.companyName.trim(),
    contactName: form.contactName.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    source: form.source,
    stage: form.stage,
    notes: form.notes.trim(),
    nextFollowUp: form.nextFollowUp || null,
    ownerId: form.ownerId || null,
  };
}

/** Only the fields an edit changed, so a save never rewrites what someone else just set. */
export function changedFields(form, client) {
  const body = clientBody(form);
  const before = clientBody(formFrom(client));
  return Object.fromEntries(Object.entries(body).filter(([key, value]) => before[key] !== value));
}
