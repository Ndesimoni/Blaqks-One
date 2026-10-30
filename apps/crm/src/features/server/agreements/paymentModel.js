import { parseAed } from '../../../lib/finance/money.js';
import { dubaiToday } from '../../../lib/dubaiDate.js';

/** Validate the exact AED/date pair without rounding or accepting invalid calendar dates. */
export function readPayment(amount, paidOn, remaining, today = dubaiToday()) {
  const parsed = parseAed(amount);
  const stamp = new Date(`${paidOn}T00:00:00Z`);
  const dateValid =
    /^\d{4}-\d{2}-\d{2}$/.test(paidOn) &&
    !Number.isNaN(stamp.valueOf()) &&
    stamp.toISOString().slice(0, 10) === paidOn &&
    paidOn <= today;
  if (parsed.error || !parsed.value || parsed.value > remaining || !dateValid) return null;
  return { amountFils: parsed.value, paidOn };
}

/** A paid entry can receive just one confirm/withdraw event. */
export const paymentStatus = (entry, entries) =>
  entries.find((item) => item.referenceId === entry.id)?.action || 'paid';
