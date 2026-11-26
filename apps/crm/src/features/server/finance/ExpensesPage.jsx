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
      teamIntro: 'Every expense recorded in this workspace.',
      ownIntro: 'Expenses you incurred.',
      empty: 'Record what you spend so an approver can review it.',
      date: (entry) => `Paid ${readableDate(entry.datePaid)}`,
      title: describe,
      columns: [
        { label: 'Category', cell: (entry) => entry.category || '—' },
        { label: 'Amount', num: true, cell: (entry) => formatAed(entry.amountFils) },
        { label: 'Date', cell: (entry) => readableDate(entry.datePaid) },
        // Beyond the approved mockup's columns, one tick away in the column chooser.
        { label: 'Incurred by', extra: true, cell: (entry) => entry.incurredBy.name },
        { label: 'Details', extra: true, cell: describe },
        {
          label: 'Receipt',
          extra: true,
          cell: (entry) => <ReceiptLink url={entry.receiptUrl} />,
        },
      ],
    }),
    [],
  );
  return <EntriesPage kind="expenses" view={view} />;
}
