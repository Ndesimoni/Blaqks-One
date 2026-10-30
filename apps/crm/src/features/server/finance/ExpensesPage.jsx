import React, { useMemo } from 'react';
import { readableDate } from '../../../lib/dates.js';
import { formatAed } from '../../../lib/finance/money.js';
import { EntriesPage } from './EntriesPage.jsx';
import { ReceiptLink } from './ReceiptLink.jsx';

const describe = (entry) =>
  [entry.category, entry.supplier].filter(Boolean).join(' · ') || 'Uncategorised expense';

/**
 * "Business expenses" (finance-design §7): expenses belong to whoever incurred them. The own
 * view lists the caller's own; team finance lists every expense. Only approved expenses count
 * in totals; receipt links open safely in a new tab.
 */
export function ExpensesPage() {
  const view = useMemo(
    () => ({
      icon: 'money',
      teamHeading: 'Team expenses',
      teamIntro: 'Every expense recorded in this workspace.',
      ownHeading: 'Your expenses',
      ownIntro: 'Expenses you incurred.',
      empty: 'Record what you spend so an approver can review it.',
      date: (entry) => `Paid ${readableDate(entry.datePaid)}`,
      title: describe,
      columns: [
        { label: 'Incurred by', cell: (entry) => entry.incurredBy.name },
        { label: 'Details', cell: describe },
        { label: 'Receipt', cell: (entry) => <ReceiptLink url={entry.receiptUrl} /> },
        { label: 'Amount', num: true, cell: (entry) => formatAed(entry.amountFils) },
      ],
    }),
    [],
  );
  return <EntriesPage kind="expenses" view={view} />;
}
