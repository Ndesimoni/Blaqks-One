import { dubaiToday } from '../../../lib/dubaiDate.js';

/**
 * Payments and expenses presets (design step 2d): the approved mockup's first, then the
 * earlier status filters, so none is lost (owner, 2026-11-01). The first is the default.
 */
export const entryPresets = Object.freeze({
  payments: [
    'This month',
    'Waiting for approval',
    'Approved',
    'Rejected',
    'Voided',
    'All payments',
  ],
  expenses: [
    'This month',
    'Waiting for approval',
    'Marketing',
    'Approved',
    'Rejected',
    'Voided',
    'All expenses',
  ],
});

/** The approvers' queue: every pending row; each row's `allowed` decides its buttons. */
export const WAITING = 'Waiting for approval';

const statusOf = {
  [WAITING]: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  Voided: 'void',
};

/** A payment counts in the month it was received, an expense in the month it was paid. */
const dayOf = (entry) => String(entry.receiptDate || entry.datePaid || '');

/** Whether a row belongs to a preset; `today` is the Dubai calendar day (`YYYY-MM-DD`). */
export function inPreset(entry, preset, today = dubaiToday()) {
  if (preset === 'This month') return dayOf(entry).slice(0, 7) === today.slice(0, 7);
  // Expense categories are typed freely, so any category naming marketing counts.
  if (preset === 'Marketing') return /marketing/i.test(entry.category || '');
  if (statusOf[preset]) return entry.status === statusOf[preset];
  return true;
}
