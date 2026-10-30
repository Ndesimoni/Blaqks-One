/**
 * Strict readers for finance responses (finance-design §7, §13 L-F3). Money must be a safe
 * integer number of fils, shares whole basis points; anything else, including a float, a
 * numeric string or an integer beyond `Number.MAX_SAFE_INTEGER`, rejects the whole response.
 */
import { isBp, isFils } from '../../../lib/finance/money.js';

export const invalidFinanceMessage = 'The CRM server returned invalid finance information.';
export const invalidFinance = () => new Error(invalidFinanceMessage);

const check = (ok, value) => {
  if (!ok) throw invalidFinance();
  return value;
};

/** A plain JSON object. */
export const object = (value) =>
  check(Boolean(value) && typeof value === 'object' && !Array.isArray(value), value);
/** Row money: 0 to AED 100bn. */
export const fils = (value) => check(isFils(value), value);
/** Totals may sum past the row cap but must stay exact. */
export const total = (value) => check(Number.isSafeInteger(value) && value >= 0, value);
export const bp = (value) => check(isBp(value), value);
export const version = (value) => check(Number.isSafeInteger(value) && value >= 1, value);
export const text = (value) => check(typeof value === 'string', value);
export const id = (value) => check(typeof value === 'string' && value.length > 0, value);
export const isoDate = (value) =>
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), value);
export const oneOf = (options) => (value) => check(options.includes(value), value);
export const boolean = (value) => check(typeof value === 'boolean', value);

/** `read` for a present value; null for null or a missing key. */
export const optional = (read) => (value) =>
  value === null || value === undefined ? null : read(value);

/** `{ id, name }` for a member reference. */
export const person = (value) => ({ id: id(object(value).id), name: text(value.name) });

/** A holder: null (the queue), an ID string or `{ id, name }`; always `{ id, name }` or null. */
export function holder(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return { id: id(value), name: null };
  return person(value);
}

/** Per-row `allowed`: only JSON `true` allows; a missing object allows nothing. */
export function allowed(value, keys) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(keys.map((key) => [key, source[key] === true]));
}

/** An array read item by item, refusing duplicate `key` values (e.g. IDs). */
export function list(value, read, key) {
  const rows = check(Array.isArray(value), value).map(read);
  if (key && new Set(rows.map((row) => row[key])).size !== rows.length) throw invalidFinance();
  return rows;
}

/** Workbook text fields (§13 L-F6): string values only. */
export function details(value) {
  const entries = Object.entries(object(value ?? {}));
  return Object.fromEntries(entries.map(([key, entry]) => [key, text(entry)]));
}

/** Receipt links are https only (§13 L-F5); anything else is dropped, never rendered. */
export function receiptUrl(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}
