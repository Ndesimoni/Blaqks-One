/**
 * AED and percentage edges for connected finance (finance-design §2.3, §7). Money is whole
 * fils (1 AED = 100 fils) and shares are basis points (10000 = 100%). Text is parsed digit by
 * digit and formatted from integers with BigInt, so no value ever passes through a float.
 */
export const MAX_FILS = 10_000_000_000_000; // AED 100bn, the storage cap for any money column.
export const MAX_BP = 10_000;
export const amountMessage = 'Enter AED amounts with up to two decimal places.';
export const rangeMessage = 'Amounts must be whole fils between 0 and AED 100,000,000,000.';
export const percentMessage = 'Percentages must be between 0 and 100 with up to two decimals.';

const plainDigits = /^\d+$/;
const groupedDigits = /^\d{1,3}(,\d{3})+$/;

/** True for an integer number of fils the server accepts (0 to AED 100bn). */
export const isFils = (value) => Number.isSafeInteger(value) && value >= 0 && value <= MAX_FILS;
/** True for an integer share from 0 to 10000 basis points. */
export const isBp = (value) => Number.isSafeInteger(value) && value >= 0 && value <= MAX_BP;

/**
 * Splits trimmed decimal text into whole and fraction digits. Whole digits may use correct
 * thousands grouping ("2,450,000"); signs, exponents, spaces and other separators are refused.
 */
function decimalParts(text) {
  const [whole, fraction, extra] = text.trim().split('.');
  if (extra !== undefined || !(plainDigits.test(whole) || groupedDigits.test(whole))) return null;
  if (fraction !== undefined && !plainDigits.test(fraction)) return null;
  return { whole: whole.replaceAll(',', ''), fraction: fraction ?? '' };
}

/**
 * AED text → fils. Blank text is `{ value: null, error: '' }` so forms decide whether the
 * field is required. More than two decimals, negatives and non-numeric text are refused,
 * never rounded: `"2,450,000.5"` → `{ value: 245000050, error: '' }`.
 */
export function parseAed(text) {
  if (typeof text !== 'string') return { value: null, error: amountMessage };
  if (!text.trim()) return { value: null, error: '' };
  const parts = decimalParts(text.trim().replace(/^AED/i, ''));
  if (!parts || parts.fraction.length > 2) return { value: null, error: amountMessage };
  const fils = BigInt(parts.whole) * 100n + BigInt(parts.fraction.padEnd(2, '0'));
  if (fils > BigInt(MAX_FILS)) return { value: null, error: rangeMessage };
  return { value: Number(fils), error: '' };
}

/** Percentage text ("12.5", "60%") → basis points, refusing more than two decimals or 100%+. */
export function parsePercent(text) {
  if (typeof text !== 'string') return { value: null, error: percentMessage };
  if (!text.trim()) return { value: null, error: '' };
  const parts = decimalParts(text.trim().replace(/%$/, ''));
  if (!parts || parts.fraction.length > 2 || parts.whole.length > 5)
    return { value: null, error: percentMessage };
  const bp = Number(parts.whole) * 100 + Number(parts.fraction.padEnd(2, '0'));
  return bp > MAX_BP ? { value: null, error: percentMessage } : { value: bp, error: '' };
}

function wholeFils(fils) {
  if (typeof fils === 'bigint') return fils;
  if (Number.isSafeInteger(fils)) return BigInt(fils);
  throw new TypeError('Money values must be whole fils.');
}

/** Fils → plain AED decimal text for inputs and exports: 245000050 → "2450000.50". */
export function filsToAed(fils) {
  const value = wholeFils(fils);
  const size = value < 0n ? -value : value;
  const cents = String(size % 100n).padStart(2, '0');
  return `${value < 0n ? '-' : ''}${size / 100n}.${cents}`;
}

const group = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Fils → grouped AED with two decimals: 245000050 → "2,450,000.50". */
export function formatFils(fils) {
  const [whole, fraction] = filsToAed(fils).split('.');
  return `${group(whole)}.${fraction}`;
}

/** Display text, "AED 2,450,000.50"; a missing value shows a dash. */
export function formatAed(fils) {
  return fils === null || fils === undefined ? '—' : `AED ${formatFils(fils)}`;
}

/** Basis points → percentage text without trailing zeros: 1250 → "12.5", 6000 → "60". */
export function bpToPercent(bp) {
  if (!isBp(bp)) throw new TypeError('Shares must be whole basis points from 0 to 10000.');
  // Basis points are hundredths of a percent, as fils are hundredths of a dirham.
  const [whole, fraction] = filsToAed(bp).split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole;
}

/** Display text, "12.5%"; a missing value shows a dash. */
export function formatPercent(bp) {
  return bp === null || bp === undefined ? '—' : `${bpToPercent(bp)}%`;
}

/**
 * `part / whole` in basis points, half-up (the workbook's 2 dp "Your share %", §2.3).
 * A zero or negative whole gives 0.
 */
export function shareOfBp(part, whole) {
  const [top, bottom] = [wholeFils(part), wholeFils(whole)];
  if (bottom <= 0n || top <= 0n) return 0;
  return Number((top * 20_000n + bottom) / (2n * bottom));
}
