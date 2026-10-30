/**
 * Connected-only workbook export map (finance-design §2.3). Workbook columns keep their sheet
 * order and the connected columns are appended after them; `src/data/schemas/deals.js` (the
 * frozen demo) is never changed. Calculated cells come from the server's `calculation`,
 * never recomputed. Money cells are exact AED text ("2450000.50") converted from integer
 * fils; the P10 export step writes them as two-decimal numbers. Views come from the caller's
 * own scoped overview, so own-view exports contain only the caller's rows and line.
 */
import { dealsColumns, expensesColumns, paymentsColumns } from '../../../data/schemas/deals.js';
import { schema } from '../../../lib/schema.js';
import { bpToPercent, filsToAed, shareOfBp } from '../../../lib/finance/money.js';
import {
  entryStatusLabels,
  feeBasisLabels,
  paymentStatusLabels,
  splitSourceLabels,
} from './financeLabels.js';

const blank = (value) => value === null || value === undefined;
const money = (value) => (blank(value) ? '' : filsToAed(value));
const percent = (value) => (blank(value) ? '' : bpToPercent(value));
const plain = (value) => (blank(value) ? '' : String(value));

/** "Your…" is the caller's own line, or the company line for a team view (§2.3). */
function yours(deal) {
  const calc = deal.calculation;
  if (!calc) return null;
  if (!blank(calc.companyFils)) return calc.companyFils;
  return calc.lines.find((line) => line.role === 'primary')?.amountFils ?? null;
}
const line = (deal, role) => deal.calculation?.lines.find((entry) => entry.role === role);
const earned = (deal) => Boolean(deal.earnedOn && deal.calculation && !deal.calculation.preview);

const dealCells = {
  'Deal ID': (deal) => deal.dealId,
  'Client ID': (deal) => deal.clientId,
  'Property ID': (deal) => plain(deal.propertyId),
  'Sale / rental': (deal) => deal.dealType,
  'Deal stage': (deal) => deal.stage,
  'Agreed value AED': (deal) => money(deal.agreedValueFils),
  'Fee basis': (deal) => feeBasisLabels[deal.feeBasis],
  'Fee rate %': (deal) => (deal.feeBasis === 'percentage' ? percent(deal.feeRateBp) : ''),
  'Fixed fee AED': (deal) => (deal.feeBasis === 'fixed' ? money(deal.fixedFeeFils) : ''),
  'Gross fee AED ex VAT': (deal) => money(deal.calculation?.grossFils),
  'Partner share %': (deal) => percent(deal.partnerShareBp),
  'After partner AED': (deal) => money(deal.calculation?.netFils),
  'Your share %': (deal) =>
    blank(yours(deal)) ? '' : percent(shareOfBp(yours(deal), deal.calculation.netFils)),
  'Your expected fee AED': (deal) => money(yours(deal)),
  'Earned date': (deal) => plain(deal.earnedOn),
  'Your earned fee AED': (deal) => (earned(deal) ? money(yours(deal)) : ''),
  'Fee received AED ex VAT': (deal) => money(deal.receivedFils),
  'Outstanding AED': (deal) => money(deal.outstandingFils),
  'Payment status': (deal) => paymentStatusLabels[deal.paymentStatus],
};

const dealAppended = {
  Agent: (deal) => plain(deal.assignee?.name ?? deal.assignee?.id),
  'Second agent': (deal) => plain(deal.secondAgent?.name),
  'Company share AED': (deal) => money(deal.calculation?.companyFils),
  'Agent commission AED': (deal) => money(line(deal, 'primary')?.amountFils),
  'Second agent commission AED': (deal) => money(line(deal, 'second')?.amountFils),
  'VAT AED': (deal) => money(deal.calculation?.vatFils),
  'Split source': (deal) => {
    const calc = deal.calculation;
    if (calc?.splitSource) return splitSourceLabels[calc.splitSource];
    return calc?.adjusted ? splitSourceLabels.override : '';
  },
};

const paymentCells = {
  'Payment ID': (row) => row.paymentId,
  'Deal ID': (row) => row.dealId,
  'Receipt date': (row) => row.receiptDate,
  'Your fee received AED ex VAT': (row) => money(row.amountFils),
  'VAT received AED': (row) => money(row.vatFils),
  'Total received AED': (row) => money(row.totalFils),
  'Payment reference': (row) => plain(row.reference),
  Notes: (row) => plain(row.notes),
};

const expenseCells = {
  'Expense ID': (row) => row.expenseId,
  'Date paid': (row) => row.datePaid,
  'Expense category': (row) => plain(row.category),
  'Platform / supplier': (row) => plain(row.supplier),
  'Campaign reference': (row) => plain(row.campaignReference),
  'Property ID': (row) => plain(row.propertyId),
  'Amount paid AED': (row) => money(row.amountFils),
  'Receipt URL': (row) => plain(row.receiptUrl),
  Notes: (row) => plain(row.notes),
};

const approvalAppended = {
  'Approval status': (row) => entryStatusLabels[row.status],
  'Submitted by': (row) => row.submittedBy.name,
  'Decided by': (row) => plain(row.decidedBy?.name),
  'Decision reason': (row) => plain(row.reason),
};

/** Workbook columns in sheet order; uncalculated deal text comes from `details` by field key. */
function sheet(module, columns, cells, appended) {
  const keys = Object.fromEntries(schema(module).map((field) => [field.name, field.key]));
  const workbook = columns.map(({ name }) => ({
    name,
    value: cells[name] ?? ((view) => plain(view.details?.[keys[name]])),
  }));
  const extra = Object.entries(appended).map(([name, value]) => ({ name, value }));
  return Object.freeze([...workbook, ...extra]);
}

export const financeColumns = Object.freeze({
  Deals: sheet('Deals', dealsColumns, dealCells, dealAppended),
  Payments: sheet('Payments', paymentsColumns, paymentCells, approvalAppended),
  Expenses: sheet('Expenses', expensesColumns, expenseCells, approvalAppended),
});

/** Connected-only column names appended after each sheet's workbook columns. */
export const appendedColumns = Object.freeze({
  Deals: Object.keys(dealAppended),
  Payments: Object.keys(approvalAppended),
  Expenses: Object.keys(approvalAppended),
});

/** Export rows `{ column name: text }` for one sheet's parsed views. */
export function financeExportRows(module, views) {
  const columns = financeColumns[module];
  if (!columns) throw new Error(`No finance export map for ${module}.`);
  return views.map((view) => Object.fromEntries(columns.map((c) => [c.name, c.value(view)])));
}
