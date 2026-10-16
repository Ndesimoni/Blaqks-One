/**
 * Dashboard finance figures (finance-design §7), read only from the scoped `GET /finance`
 * overview so every figure equals the server's totals. The own view shows the caller's
 * commission statement totals and their own pending submissions; it never derives company or
 * team figures. The team view shows the server's team totals as sent.
 */
import { formatAed } from '../../../lib/finance/money.js';

const tile = (id, label, fils, note) => ({ id, label, value: formatAed(fils), note });

/** Own-view count: pending payments and expenses the caller submitted. */
export function ownPendingCount(overview, me) {
  return [...overview.payments, ...overview.expenses].filter(
    (row) => row.status === 'pending' && row.submittedBy.id === me,
  ).length;
}

/** `{ scope, tiles: [{ id, label, value, note }], pending: { count, label } }`. */
export function financeFigures(overview, me) {
  if (overview.scope === 'team' && overview.teamTotals) {
    const totals = overview.teamTotals;
    return {
      scope: 'team',
      tiles: [
        tile('fees', 'Fees earned', totals.grossFils, 'Gross fees on earned deals'),
        tile('company', 'Company share', totals.companyFils, 'After agent commission'),
        tile('received', 'Received', totals.receivedFils, 'Approved payments'),
        tile('outstanding', 'Outstanding', totals.outstandingFils, 'Net fees still to receive'),
        tile('vat', 'VAT on fees', totals.vatFils, 'On earned deals'),
        tile('expenses', 'Approved expenses', totals.expensesApprovedFils, 'Approved only'),
      ],
      pending: { count: totals.pendingCount, label: 'Awaiting approval' },
    };
  }
  const totals = overview.statement.totals;
  return {
    scope: 'own',
    tiles: [
      tile('earned', 'Your commission earned', totals.earnedFils, 'On your earned deals'),
      tile('received', 'Received share', totals.receivedShareFils, 'From approved payments'),
      tile('outstanding', 'Outstanding', totals.outstandingFils, 'Still to be received'),
    ],
    pending: {
      count: ownPendingCount(overview, me),
      label: 'Your submissions awaiting approval',
    },
  };
}

/**
 * Ring parts and centre figure. Team: received, outstanding and approved expenses, with net
 * received (received less approved expenses) in the centre. Own: the caller's received share
 * and outstanding commission around their commission earned; never a company figure.
 */
export function financeRing(overview) {
  if (overview.scope === 'team' && overview.teamTotals) {
    const totals = overview.teamTotals;
    return {
      segments: [
        { name: 'Received', value: totals.receivedFils, tone: 'accent' },
        { name: 'Outstanding', value: totals.outstandingFils, tone: 'blue' },
        { name: 'Approved expenses', value: totals.expensesApprovedFils, tone: 'amber' },
      ],
      centre: { label: 'Net received', value: totals.receivedFils - totals.expensesApprovedFils },
    };
  }
  const totals = overview.statement.totals;
  return {
    segments: [
      { name: 'Received share', value: totals.receivedShareFils, tone: 'accent' },
      { name: 'Outstanding', value: totals.outstandingFils, tone: 'blue' },
    ],
    centre: { label: 'Commission earned', value: totals.earnedFils },
  };
}
