/**
 * The editable agreement draft (docs/agreements-design.md §2, §3, §6, §11): text fields for
 * the form, built empty or from a revision's frozen terms. Money is typed in AED and shares
 * as percentages; `readDraft` turns them into fils and basis points without floats.
 */
import { bpToPercent, filsToAed } from '../../../lib/finance/money.js';
import { dubaiToday, shiftDay } from '../../../lib/dubaiDate.js';

export const DEFAULT_DAYS = 14;
/** The server allows 90 days; the end of the Dubai day 89 days ahead always fits. */
export const MAX_DAYS = 89;
export const BASES = ['commission', 'fixed'];
export const PAYMENTS = ['on_transfer', 'on_receipt', 'on_completion'];

/** The first and last offer end days a person can choose, as `YYYY-MM-DD`. */
export const expiryRange = (today = dubaiToday()) => ({
  min: shiftDay(today, 1),
  max: shiftDay(today, MAX_DAYS),
});

/** The end of a Dubai day (23:59:59, UTC+4) as the server's UTC timestamp. */
export const endOfDubaiDay = (day) => `${day}T19:59:59Z`;

/** The Dubai day an offer ends, from its stored timestamp. */
export const expiryDay = (stamp) => (stamp ? dubaiToday(new Date(stamp)) : '');

/** Option pairs from a list, keeping a stored value that is no longer listed. */
export const optionsOf = (list, current) =>
  (current && !list.includes(current) ? [current, ...list] : list).map((item) => [item, item]);

/** A listing label made inside the agreement, never a CRM property ID (§6). */
export const generatedRef = (now = Date.now()) => `AG-${now.toString(36).toUpperCase().slice(-6)}`;

const defaultShare = { handover_full: '0', handover_referral: '25', co_broking: '50' };

export function emptyDraft(kind = 'co_broking', today = dubaiToday(), now = Date.now()) {
  return {
    kind,
    emirate: 'Dubai',
    area: '',
    propertyType: 'Apartment',
    bedrooms: '',
    sizeSqft: '',
    askingPrice: '',
    listingRef: generatedRef(now),
    clientName: '',
    shareContact: false,
    contact: '',
    basis: 'commission',
    amount: '',
    senderShare: defaultShare[kind],
    paymentExpectation: 'on_transfer',
    collectingParty: '',
    governingEmirate: 'Dubai',
    expiresOn: shiftDay(today, DEFAULT_DAYS),
    notes: '',
  };
}

/** A type change keeps every entry but resets the share to that type's starting value. */
export const withKind = (draft, kind) => ({ ...draft, kind, senderShare: defaultShare[kind] });

/**
 * The draft for revising a draft or answering with a counter-offer: every frozen value of
 * `terms`, with an offer end day that can still be sent (the old one, or the default).
 */
export function draftFromTerms(kind, terms, today = dubaiToday()) {
  const { property, client } = terms.subject;
  const { money } = terms;
  const { min, max } = expiryRange(today);
  const previous = expiryDay(terms.expiresAt);
  const usable = previous && previous >= min && previous <= max;
  return {
    kind,
    emirate: property.emirate,
    area: property.area,
    propertyType: property.propertyType,
    bedrooms: String(property.bedrooms),
    sizeSqft: String(property.sizeSqft),
    askingPrice: filsToAed(property.askingPriceFils),
    listingRef: property.listingRef,
    clientName: client.displayName,
    shareContact: Boolean(client.contact),
    contact: client.contact || '',
    basis: money.basis,
    amount: filsToAed(money.amountFils),
    senderShare: bpToPercent(money.senderShareBp),
    paymentExpectation: money.paymentExpectation,
    collectingParty: money.collectingParty || '',
    governingEmirate: terms.governingEmirate,
    expiresOn: usable ? previous : shiftDay(today, DEFAULT_DAYS),
    notes: terms.notes || '',
  };
}
