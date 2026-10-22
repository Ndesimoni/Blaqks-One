/**
 * Draft → the server's exact terms (services/crm-api/src/agreements/terms.rs): trimmed text
 * within the same limits, whole counts, fils from AED text and basis points from percentage
 * text, never through a float. Errors name the field and the catalogue reason.
 */
import { parseAed, parsePercent } from '../../../lib/finance/money.js';
import { dubaiToday } from '../../../lib/dubaiDate.js';
import { BASES, PAYMENTS, endOfDubaiDay, expiryRange } from './agreementDraft.js';

/**
 * Sender share limits in basis points per type (model.rs `Kind::shares`). A referral is
 * further capped by the sending company's limit in Finance settings, which the server
 * checks (agreements design §14).
 */
export const SHARE_LIMITS = {
  handover_full: [0, 0],
  handover_referral: [1, 9_999],
  co_broking: [1, 9_999],
};

export const STEP_FIELDS = {
  subject: [
    'emirate',
    'area',
    'propertyType',
    'bedrooms',
    'sizeSqft',
    'askingPrice',
    'listingRef',
    'clientName',
    'contact',
  ],
  money: [
    'basis',
    'amount',
    'senderShare',
    'paymentExpectation',
    'governingEmirate',
    'expiresOn',
    'notes',
  ],
};

const length = (text) => [...text].length;

function text(value, max, optional = false) {
  const clean = String(value ?? '').trim();
  if (!clean) return optional ? { value: null } : { error: 'required' };
  return length(clean) > max ? { error: 'tooLong', max } : { value: clean };
}

function whole(value, max) {
  const clean = String(value ?? '').trim();
  if (!clean) return { error: 'required' };
  return /^\d+$/.test(clean) && Number(clean) <= max
    ? { value: Number(clean) }
    : { error: 'whole', max };
}

function money(value) {
  const { value: fils, error } = parseAed(String(value ?? ''));
  if (!error && fils === null) return { error: 'required' };
  return !error && fils >= 1 ? { value: fils } : { error: 'amount' };
}

/** The sending company's share; a full handover always keeps nothing. */
export function readShare(kind, value) {
  const [min, max] = SHARE_LIMITS[kind] ?? [0, 0];
  if (kind === 'handover_full') return { value: 0 };
  const { value: bp, error } = parsePercent(String(value ?? ''));
  if (!error && bp === null) return { error: 'required' };
  if (!error && bp >= min && bp <= max) return { value: bp };
  return { error: kind === 'co_broking' ? 'shareCoBroking' : 'shareReferral' };
}

const choice = (value, allowed) => (allowed.includes(value) ? { value } : { error: 'required' });

function expiry(day, today) {
  const { min, max } = expiryRange(today);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day || '') && day >= min && day <= max;
  return valid ? { value: endOfDubaiDay(day) } : { error: 'expiry' };
}

/** `{ terms, errors }`: terms in the server's shape when every field is valid, else null. */
export function readDraft(draft, today = dubaiToday()) {
  const fields = {
    emirate: text(draft.emirate, 40),
    area: text(draft.area, 80),
    propertyType: text(draft.propertyType, 40),
    bedrooms: whole(draft.bedrooms, 20),
    sizeSqft: whole(draft.sizeSqft, 1_000_000),
    askingPrice: money(draft.askingPrice),
    listingRef: text(draft.listingRef, 40),
    clientName: text(draft.clientName, 80),
    contact: draft.shareContact ? text(draft.contact, 120) : { value: null },
    basis: choice(draft.basis, BASES),
    amount: money(draft.amount),
    senderShare: readShare(draft.kind, draft.senderShare),
    paymentExpectation: choice(draft.paymentExpectation, PAYMENTS),
    governingEmirate: text(draft.governingEmirate, 40),
    expiresOn: expiry(draft.expiresOn, today),
    notes: text(draft.notes, 2_000, true),
  };
  const errors = Object.fromEntries(Object.entries(fields).filter(([, field]) => field.error));
  if (Object.keys(errors).length) return { terms: null, errors };
  const value = (key) => fields[key].value;
  const terms = {
    property: {
      emirate: value('emirate'),
      area: value('area'),
      propertyType: value('propertyType'),
      bedrooms: value('bedrooms'),
      sizeSqft: value('sizeSqft'),
      askingPriceFils: value('askingPrice'),
      listingRef: value('listingRef'),
    },
    client: { displayName: value('clientName'), contact: value('contact') },
    money: {
      basis: value('basis'),
      amountFils: value('amount'),
      senderShareBp: value('senderShare'),
      paymentExpectation: value('paymentExpectation'),
    },
    expiresAt: value('expiresOn'),
    governingEmirate: value('governingEmirate'),
    notes: value('notes'),
  };
  return { terms, errors: {} };
}

/** The errors of one form step. */
export const stepErrors = (errors, step) =>
  Object.fromEntries(Object.entries(errors).filter(([key]) => STEP_FIELDS[step]?.includes(key)));

/** Terms shaped like a stored revision's, for the review step before saving. */
export const previewTerms = (kind, terms) => ({
  kind,
  subject: { property: terms.property, client: terms.client },
  money: { ...terms.money, recipientShareBp: 10_000 - terms.money.senderShareBp },
  expiresAt: terms.expiresAt,
  governingEmirate: terms.governingEmirate,
  notes: terms.notes,
});
