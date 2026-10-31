/**
 * Payments and expenses list helpers (finance-design §7). Filters narrow rows already in the
 * caller's shaped overview; they never widen what the server returned. The approval queue is
 * every pending row; each row's server `allowed` decides whether it can be decided here.
 */
import { paymentVat } from '../../../lib/finance/commission.js';
import { referenceName } from './dealFilters.js';

export const ENTRIES_PER_PAGE = 12;
/** The Dashboard's deep link (`?q=`) that opens a list on its approval queue. */
export const QUEUE_QUERY = 'awaiting-approval';
export const entryStatusOptions = Object.freeze([
  { id: '', label: 'Any status' },
  { id: 'pending', label: 'Pending approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'void', label: 'Voided' },
]);
export const emptyEntryFilters = Object.freeze({ query: '', status: '', queue: false });

/** Filters from the route query: the queue link, or a plain search. */
export function initialEntryFilters(initialQuery) {
  if (initialQuery === QUEUE_QUERY) return { ...emptyEntryFilters, queue: true };
  return { ...emptyEntryFilters, query: initialQuery || '' };
}

export const entryFiltersActive = (filters) =>
  Boolean(filters.query || filters.status || filters.queue);

const lower = (value) => String(value ?? '').toLowerCase();

/** The searchable text of one payment or expense. */
function searchText(entry, references) {
  const property = referenceName(references, 'Properties', entry.propertyId);
  return [
    entry.paymentId,
    entry.expenseId,
    entry.dealId,
    entry.reference,
    entry.category,
    entry.supplier,
    entry.campaignReference,
    entry.propertyId,
    property,
    entry.submittedBy?.name,
    entry.incurredBy?.name,
  ].map(lower);
}

/** `{ query, status, queue }`; the queue shows pending rows only. */
export function filterEntries(entries, filters, references) {
  const query = lower(filters.query).trim();
  return entries.filter((entry) => {
    if (filters.queue && entry.status !== 'pending') return false;
    if (filters.status && entry.status !== filters.status) return false;
    return !query || searchText(entry, references).some((value) => value.includes(query));
  });
}

/** Pending rows this caller may approve or reject (the queue badge count). */
export const decidableCount = (entries) =>
  entries.filter((entry) => entry.allowed.approve || entry.allowed.reject).length;

/** The host shown beside a receipt link; null for anything that is not https. */
export function receiptHost(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.host : null;
  } catch {
    return null;
  }
}

/** Earned deals in the caller's view, the only ones a payment may be recorded on. */
export function earnedDealOptions(deals, references) {
  return deals
    .filter((deal) => deal.earnedOn && deal.calculation)
    .map((deal) => {
      const client = referenceName(references, 'Clients', deal.clientId) ?? deal.clientId;
      return { id: deal.dealId, label: `${deal.dealId} · ${client} · ${deal.dealType}`, deal };
    });
}

/**
 * A payment's VAT and total preview. VAT applies when the deal's earned figures carry VAT;
 * the server recomputes it on approval, so this is only shown as an estimate.
 */
export function paymentPreview(amountFils, deal) {
  if (!Number.isSafeInteger(amountFils) || !deal?.calculation) return null;
  const registered = deal.calculation.vatFils > 0;
  const vatFils = paymentVat(amountFils, registered);
  return { amountFils, vatFils, totalFils: amountFils + vatFils, registered };
}

/** The record ID shown for an entry. */
export const entryCode = (entry) => entry.paymentId ?? entry.expenseId;

/** The page-specific words for each kind. */
export const entryKinds = Object.freeze({
  payments: {
    noun: 'payment',
    plural: 'payments',
    title: 'Payment',
    eyebrow: 'COMMISSION RECEIPTS',
    add: 'Record payment',
  },
  expenses: {
    noun: 'expense',
    plural: 'expenses',
    title: 'Expense',
    eyebrow: 'BUSINESS EXPENSES',
    add: 'Add expense',
  },
});
