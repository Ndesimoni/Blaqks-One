/**
 * Field readers for agreement drafts (readDraft.js): trimmed text within the server's
 * limits, whole counts, fils from AED text and basis points from percentage text, never
 * through a float. Each answers `{ value }`, or `{ error }` naming the catalogue reason.
 */
import { parseAed, parsePercent } from '../../../lib/finance/money.js';
import { endOfDubaiDay, expiryRange } from './agreementDraft.js';

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

const length = (text) => [...text].length;

export function text(value, max, optional = false) {
  const clean = String(value ?? '').trim();
  if (!clean) return optional ? { value: null } : { error: 'required' };
  return length(clean) > max ? { error: 'tooLong', max } : { value: clean };
}

export function whole(value, max) {
  const clean = String(value ?? '').trim();
  if (!clean) return { error: 'required' };
  return /^\d+$/.test(clean) && Number(clean) <= max
    ? { value: Number(clean) }
    : { error: 'whole', max };
}

export function money(value) {
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

export const choice = (value, allowed) =>
  allowed.includes(value) ? { value } : { error: 'required' };

export function expiry(day, today) {
  const { min, max } = expiryRange(today);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day || '') && day >= min && day <= max;
  return valid ? { value: endOfDubaiDay(day) } : { error: 'expiry' };
}
