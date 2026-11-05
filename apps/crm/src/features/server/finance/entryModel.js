/**
 * PaymentView and ExpenseView parsing (finance-design §4, §6.2). Only `approved` rows count
 * anywhere; pending and rejected rows are shown separately. Approver identity may be absent
 * on rows in the own view, so `decidedBy` is optional for every status.
 */
import {
  allowed,
  fils,
  id,
  invalidFinance,
  isoDate,
  object,
  oneOf,
  optional,
  person,
  receiptUrl,
  text,
  version,
} from './financeValues.js';

export const entryStatuses = ['pending', 'approved', 'rejected', 'void'];
export const entryStatusLabels = Object.freeze({
  pending: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
  void: 'Voided',
});
export const entryAllowedKeys = ['edit', 'approve', 'reject', 'void'];

function readShared(row) {
  const entry = object(row);
  return {
    id: id(entry.id),
    version: version(entry.version),
    status: oneOf(entryStatuses)(entry.status),
    notes: optional(text)(entry.notes),
    submittedBy: person(entry.submittedBy),
    decidedBy: optional(person)(entry.decidedBy),
    decidedAt: optional(text)(entry.decidedAt),
    reason: optional(text)(entry.reason),
    allowed: allowed(entry.allowed, entryAllowedKeys),
  };
}

/** One PaymentView; `totalFils` must equal amount plus VAT. */
export function readPayment(row) {
  const shared = readShared(row);
  const payment = {
    ...shared,
    paymentId: id(row.paymentId),
    dealId: id(row.dealId),
    receiptDate: isoDate(row.receiptDate),
    amountFils: fils(row.amountFils),
    vatFils: fils(row.vatFils),
    totalFils: fils(row.totalFils),
    reference: optional(text)(row.reference),
  };
  if (BigInt(payment.amountFils) + BigInt(payment.vatFils) !== BigInt(payment.totalFils))
    throw invalidFinance();
  return payment;
}

/** One ExpenseView; a non-https receipt link is dropped (§13 L-F5). */
export function readExpense(row) {
  return {
    ...readShared(row),
    expenseId: id(row.expenseId),
    incurredBy: person(row.incurredBy),
    datePaid: isoDate(row.datePaid),
    category: optional(text)(row.category),
    supplier: optional(text)(row.supplier),
    campaignReference: optional(text)(row.campaignReference),
    propertyId: optional(id)(row.propertyId),
    amountFils: fils(row.amountFils),
    receiptUrl: receiptUrl(row.receiptUrl),
  };
}

/** Sum of approved amounts, exact (BigInt) and returned as a safe integer. */
export function approvedTotal(entries) {
  const sum = entries
    .filter((entry) => entry.status === 'approved')
    .reduce((total, entry) => total + BigInt(entry.amountFils), 0n);
  if (sum > BigInt(Number.MAX_SAFE_INTEGER)) throw invalidFinance();
  return Number(sum);
}

/** Filters for the approval queue and status chips. */
export const awaitingApproval = (entries) => entries.filter((entry) => entry.status === 'pending');
export const entriesWithStatus = (entries, status) =>
  status ? entries.filter((entry) => entry.status === status) : entries;
