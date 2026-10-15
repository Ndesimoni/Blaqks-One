/**
 * Finance history (`GET /finance/{deals|payments|expenses}/{id}/history`, finance-design §5.3,
 * §16.7). Team view items carry the actor's ID, changes and reasons; own-view items are a
 * timeline with the reason of rejections only, and nothing else is kept even if sent.
 */
import { formatAed, formatPercent } from '../../../lib/finance/money.js';
import { id, list, object, optional, text } from './financeValues.js';

export const historyActionLabels = Object.freeze({
  created: 'Created',
  updated: 'Edited',
  submitted: 'Submitted',
  resubmitted: 'Corrected and resubmitted',
  approved: 'Approved',
  rejected: 'Rejected',
  voided: 'Voided',
  earned: 'Marked earned',
  revised: 'Revised',
  unearned: 'Unearned',
  split_changed: 'Split changed',
  assigned: 'Holder changed',
  closed: 'Closed',
  deleted: 'Deleted',
  reopened: 'Reopened',
});

function readItem(value, team) {
  const item = object(value);
  const actor = object(item.actor);
  const action = text(item.action);
  const reason = team || action === 'rejected' ? optional(text)(item.reason) : null;
  return {
    at: text(item.at),
    action,
    actor: { id: team ? optional(id)(actor.id) : null, name: text(actor.name) },
    changes: team && item.changes && typeof item.changes === 'object' ? item.changes : null,
    reason,
  };
}

/** `{ history: [...] }` shaped by the caller's scope, oldest first as the server sends it. */
export function readHistory(payload, team) {
  return list(object(payload).history, (row) => readItem(row, team));
}

/** "Rejected", or the raw action when the server adds one this screen does not know yet. */
export const historyLabel = (action) => historyActionLabels[action] ?? action.replaceAll('_', ' ');

const dubai = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dubai',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** An event time in the business timezone; unreadable values are shown as sent. */
export function historyTime(at) {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? at : dubai.format(date);
}

const fieldLabels = Object.freeze({
  amountFils: 'Amount',
  vatFils: 'VAT',
  receiptDate: 'Receipt date',
  datePaid: 'Date paid',
  reference: 'Reference',
  notes: 'Notes',
  category: 'Category',
  supplier: 'Supplier',
  campaignReference: 'Campaign reference',
  propertyId: 'Property',
  receiptUrl: 'Receipt link',
  incurredBy: 'Incurred by',
  dealId: 'Deal',
  status: 'Status',
  selfDecided: 'Decided by an Admin on their own record',
  earnedOn: 'Earned date',
  netFils: 'Net fee',
});

const humanise = (key) =>
  key
    .replace(/(Fils|Bp)$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (first) => first.toUpperCase());

/** One stored value as text: money and shares formatted, objects summarised. */
function valueText(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Number.isSafeInteger(value) && value >= 0 && key.endsWith('Fils')) return formatAed(value);
  if (Number.isSafeInteger(value) && value >= 0 && value <= 10_000 && key.endsWith('Bp'))
    return formatPercent(value);
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return 'changed';
}

/**
 * Team-view change lines: `{ field: [before, after] }` pairs read "Amount: A → B"; single
 * values read "Field: value". Receipt links and free text arrive as "changed" (§13 L-F5).
 */
export function changeLines(changes) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return [];
  return Object.entries(changes).map(([key, value]) => {
    const label = fieldLabels[key] ?? humanise(key);
    if (Array.isArray(value) && value.length === 2)
      return `${label}: ${valueText(key, value[0])} → ${valueText(key, value[1])}`;
    if (key === 'selfDecided') return value === true ? label : `${label}: ${valueText(key, value)}`;
    return `${label}: ${valueText(key, value)}`;
  });
}
