/**
 * Connected date search over data the caller can already see: scoped records, and finance rows
 * only for members with finance access. Nothing here widens what the server returned.
 */
import { clName, get, prName } from '../../../lib/records.js';
import { schema } from '../../../lib/schema.js';
import { dubaiToday, shiftDay } from '../../../lib/dubaiDate.js';
import { referenceName } from '../finance/dealFilters.js';

export const recordSearchTypes = [
  { title: 'New enquiries', module: 'Clients', field: 'Date added' },
  { title: 'Follow-ups', module: 'Follow-ups', field: 'Due date' },
  { title: 'Viewings', module: 'Viewings', field: 'Appointment date & time' },
  { title: 'Care appointments', module: 'Client care', field: 'Next contact' },
];
export const financeSearchTypes = [
  { title: 'Deals earned', module: 'Deals', finance: 'deals', field: 'earnedOn' },
  { title: 'Fee receipts', module: 'Payments', finance: 'payments', field: 'receiptDate' },
  { title: 'Expenses paid', module: 'Expenses', finance: 'expenses', field: 'datePaid' },
];

/** Record types the caller may open, then finance types only with finance access. */
export function availableSearchTypes({ canOpen, financeAllowed }) {
  const records = recordSearchTypes.filter((type) => canOpen(type.module));
  return financeAllowed ? [...records, ...financeSearchTypes] : records;
}

/** The opening filter: every type over the last 30 Asia/Dubai days up to today. */
export const defaultDateFilter = (today = dubaiToday()) => ({
  type: '',
  start: shiftDay(today, -30),
  end: today,
});

export const invalidDateRange = (filter) =>
  Boolean(filter.start && filter.end && filter.start > filter.end);

const inRange = (value, filter) =>
  Boolean(value) &&
  (!filter.start || value >= filter.start) &&
  (!filter.end || value <= filter.end);

function recordRow(type, row, data) {
  const client = clName(data, get(row, 'Client ID'));
  return {
    key: String(get(row, schema(type.module)[0].name)),
    title: String(get(row, schema(type.module)[0].name)),
    subtitle: client !== '—' ? client : prName(data, get(row, 'Property ID')),
    date: String(get(row, type.field) || '').slice(0, 10),
    record: row,
  };
}

function financeRow(type, entry, overview) {
  const refs = overview.references;
  const deal = entry.dealId && overview.deals.find((row) => row.dealId === entry.dealId);
  const client = referenceName(refs, 'Clients', deal?.clientId);
  const code = entry.paymentId ?? entry.expenseId ?? entry.dealId;
  const detail = entry.supplier || entry.category || '';
  return {
    key: entry.id,
    title: code,
    subtitle: client || detail || '',
    date: entry[type.field] || '',
    record: null,
  };
}

/** Rows for the selected type in the range, oldest first; an inverted range finds nothing. */
export function selectConnectedDateRows(data, overview, filter, types) {
  const type = types.find((item) => item.title === filter.type) || types[0] || null;
  const invalidRange = invalidDateRange(filter);
  if (!type || invalidRange) return { type, rows: [], invalidRange };
  const safe = { Clients: [], Properties: [], ...data };
  const source = type.finance
    ? (overview?.[type.finance] ?? []).map((entry) => financeRow(type, entry, overview))
    : (data[type.module] ?? []).map((row) => recordRow(type, row, safe));
  const rows = source
    .filter((row) => inRange(row.date, filter))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { type, rows, invalidRange };
}
