/**
 * Payment drafts and the validators shared with expenses (finance-design §4, §6.2, §16.2). Amounts are typed as AED text
 * and sent as whole fils from AED 0.01 to AED 10bn; dates are never after today (Asia/Dubai);
 * receipt links are https only (§13 L-F5). Blank optional text is sent as null. Messages match
 * the server's, so a local refusal and a server refusal read the same.
 */
import { filsToAed, parseAed } from '../../../lib/finance/money.js';

export const ENTRY_MAX_FILS = 1_000_000_000_000;
export const entryAmountMessage =
  'Amounts must be whole fils between AED 0.01 and AED 10,000,000,000.';
export const futureDateMessage = 'Payment and expense dates cannot be in the future.';
export const receiptMessage = 'Enter a valid HTTPS receipt link.';
export const dateMessage = 'Enter a valid date (YYYY-MM-DD).';
export const dealRequiredMessage = 'Choose an earned deal.';
export const amountRequiredMessage = 'Enter an amount.';

const linkLimit = 2048;

const blank = (value) => (value ?? '').trim();
/** Trimmed text, or null when blank. */
export const orNull = (value) => blank(value) || null;
const size = (value) => [...blank(value)].length;
const tooLong = (max) => `Use ${max.toLocaleString('en-US')} characters or fewer.`;

/** AED text → `{ value, error }` within the entry range (1 fil to AED 10bn). */
export function entryAmount(text) {
  if (!blank(text)) return { value: null, error: amountRequiredMessage };
  const parsed = parseAed(text);
  if (parsed.error) return parsed;
  if (parsed.value < 1 || parsed.value > ENTRY_MAX_FILS)
    return { value: null, error: entryAmountMessage };
  return parsed;
}

/** A required ISO date that is a real calendar day and not after `today`. */
export function entryDateError(value, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return dateMessage;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return dateMessage;
  return value > today ? futureDateMessage : '';
}

/** '' for a blank or valid https link; the server's message otherwise. */
export function receiptLinkError(text) {
  const value = blank(text);
  if (!value) return '';
  if (value.length > linkLimit) return receiptMessage;
  try {
    return new URL(value).protocol === 'https:' ? '' : receiptMessage;
  } catch {
    return receiptMessage;
  }
}

/** Length errors for `[[key, max]]` text fields, counted in characters like the server. */
export function textErrors(draft, fields) {
  return Object.fromEntries(
    fields
      .map(([key, max]) => [key, size(draft[key]) > max ? tooLong(max) : ''])
      .filter(([, error]) => error),
  );
}

export const emptyPaymentDraft = (today) => ({
  dealId: '',
  receiptDate: today,
  amount: '',
  reference: '',
  notes: '',
});

export const paymentDraft = (payment) => ({
  dealId: payment.dealId,
  receiptDate: payment.receiptDate,
  amount: filsToAed(payment.amountFils),
  reference: payment.reference ?? '',
  notes: payment.notes ?? '',
});

/** `{ errors, body }`; `body` is null while any field is invalid. */
export function validatePayment(draft, { today, creating }) {
  const amount = entryAmount(draft.amount);
  const errors = {
    ...(creating && !draft.dealId ? { dealId: dealRequiredMessage } : {}),
    ...(entryDateError(draft.receiptDate, today) && {
      receiptDate: entryDateError(draft.receiptDate, today),
    }),
    ...(amount.error && { amount: amount.error }),
    ...textErrors(draft, [
      ['reference', 200],
      ['notes', 4000],
    ]),
  };
  if (Object.keys(errors).length) return { errors, body: null };
  const body = {
    receiptDate: draft.receiptDate,
    amountFils: amount.value,
    reference: orNull(draft.reference),
    notes: orNull(draft.notes),
  };
  return { errors, body: creating ? { dealId: draft.dealId, ...body } : body };
}
