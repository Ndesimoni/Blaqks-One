/**
 * Off-plan payment schedule (packet Q6). Milestones use whole basis points and ISO dates;
 * their shares must total exactly 100%. Amounts come from cumulative shares so every fils is
 * allocated once and the final milestone absorbs rounding. Nothing is saved to a property.
 */
import { hu } from './commission.js';
import { bpToPercent, filsToAed, isBp, isFils } from './money.js';

export const MAX_MILESTONES = 20;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const invalid = () => new RangeError('Payment schedule values are out of range.');

/** A real calendar day in `YYYY-MM-DD` (rejects 2025-02-29 and other rollovers). */
export function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * `{ milestones: [{ label, percentBp, date, amountFils }], totalFils }`. Labels are 1–80
 * characters, shares total 10000 basis points, and dates must be in non-decreasing order.
 */
export function offPlanSchedule({ priceFils, milestones }) {
  if (!isFils(priceFils) || !Array.isArray(milestones)) throw invalid();
  if (milestones.length < 1 || milestones.length > MAX_MILESTONES) throw invalid();
  let cumulativeBp = 0;
  let allocatedFils = 0;
  let previousDate = '';
  const rows = milestones.map((milestone) => {
    const label = typeof milestone.label === 'string' ? milestone.label.trim() : '';
    if (!label || label.length > 80 || !isBp(milestone.percentBp)) throw invalid();
    if (!isIsoDate(milestone.date) || milestone.date < previousDate) throw invalid();
    cumulativeBp += milestone.percentBp;
    if (cumulativeBp > 10_000) throw invalid();
    const cumulativeFils = Number(hu(BigInt(priceFils), BigInt(cumulativeBp)));
    const amountFils = cumulativeFils - allocatedFils;
    allocatedFils = cumulativeFils;
    previousDate = milestone.date;
    return { label, percentBp: milestone.percentBp, date: milestone.date, amountFils };
  });
  if (cumulativeBp !== 10_000) throw invalid();
  return { milestones: rows, totalFils: allocatedFils };
}

const HEADERS = ['Milestone', 'Date', 'Share %', 'Amount (AED)'];
const cell = (value) => `"${String(value).replaceAll('"', '""')}"`;
const line = (values) => values.map(cell).join(',');

/** A readable CSV schedule; `headers` lets the screen export translated column names. */
export function scheduleCsv(milestones, headers = HEADERS) {
  const rows = milestones.map((milestone) =>
    line([
      milestone.label,
      milestone.date,
      bpToPercent(milestone.percentBp),
      filsToAed(milestone.amountFils),
    ]),
  );
  const total = milestones.reduce((sum, milestone) => sum + milestone.amountFils, 0);
  return [line(headers), ...rows, line(['Total', '', '100', filsToAed(total)])].join('\n');
}
