/**
 * Expense drafts (finance-design §4, §6.2, §16.2): whole fils from AED 0.01, a date paid that
 * is not in the future, an optional https receipt link and optional property. Staff record
 * expenses for themselves; only the Admin names who incurred one.
 */
import { filsToAed } from '../../../lib/finance/money.js';
import { entryAmount, entryDateError, orNull, receiptLinkError, textErrors } from './entryDraft.js';

export const emptyExpenseDraft = (today) => ({
  datePaid: today,
  amount: '',
  category: '',
  supplier: '',
  campaignReference: '',
  propertyId: '',
  receiptUrl: '',
  notes: '',
  incurredBy: '',
});

export const expenseDraft = (expense) => ({
  datePaid: expense.datePaid,
  amount: filsToAed(expense.amountFils),
  category: expense.category ?? '',
  supplier: expense.supplier ?? '',
  campaignReference: expense.campaignReference ?? '',
  propertyId: expense.propertyId ?? '',
  receiptUrl: expense.receiptUrl ?? '',
  notes: expense.notes ?? '',
  incurredBy: expense.incurredBy.id,
});

/**
 * `{ errors, body }`. Only the Admin (`manage`) sends `incurredBy`: blank on create records it
 * for the Admin, and on an edit keeps the stored owner. Staff never send it (§16.2).
 */
export function validateExpense(draft, { today, manage }) {
  const amount = entryAmount(draft.amount);
  const link = receiptLinkError(draft.receiptUrl);
  const dateError = entryDateError(draft.datePaid, today);
  const errors = {
    ...(dateError && { datePaid: dateError }),
    ...(amount.error && { amount: amount.error }),
    ...(link && { receiptUrl: link }),
    ...textErrors(draft, [
      ['category', 100],
      ['supplier', 200],
      ['campaignReference', 200],
      ['notes', 4000],
    ]),
  };
  if (Object.keys(errors).length) return { errors, body: null };
  const body = {
    datePaid: draft.datePaid,
    amountFils: amount.value,
    ...Object.fromEntries(
      ['category', 'supplier', 'campaignReference', 'propertyId', 'receiptUrl', 'notes'].map(
        (key) => [key, orNull(draft[key])],
      ),
    ),
  };
  return { errors, body: manage ? { ...body, incurredBy: draft.incurredBy || null } : body };
}
