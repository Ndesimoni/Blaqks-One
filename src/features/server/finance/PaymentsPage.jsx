import React, { useMemo } from 'react';
import { readableDate } from '../../../lib/dates.js';
import { formatAed } from '../../../lib/finance/money.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { referenceName } from './dealFilters.js';
import { EntriesPage } from './EntriesPage.jsx';

/**
 * "Commission receipts" (finance-design §7): payments received on earned deals. The own view
 * lists payments on deals the caller holds; team finance lists every payment. Only approved
 * payments count as received.
 */
export function PaymentsPage() {
  const { overview } = useFinanceContext();
  const view = useMemo(() => {
    const dealClient = (entry) => {
      const found = overview.deals.find((row) => row.dealId === entry.dealId);
      return found ? referenceName(overview.references, 'Clients', found.clientId) : null;
    };
    const deal = (entry) => {
      const client = dealClient(entry);
      return client ? `${entry.dealId} · ${client}` : entry.dealId;
    };
    return {
      icon: 'wallet',
      teamHeading: 'Team commission receipts',
      teamIntro: 'Every payment received on this workspace’s earned deals.',
      ownHeading: 'Your commission receipts',
      ownIntro: 'Payments received on deals you hold.',
      empty: 'Record a payment once a deal is earned and its fee is received.',
      date: (entry) => `Received ${readableDate(entry.receiptDate)}`,
      title: deal,
      columns: [
        {
          label: 'Deal',
          cell: (entry) => (
            <>
              <span className="cell-strong">{entry.dealId}</span>
              <small className="finance-sub">{dealClient(entry)}</small>
            </>
          ),
        },
        { label: 'Submitted by', cell: (entry) => entry.submittedBy.name },
        { label: 'Amount', num: true, cell: (entry) => formatAed(entry.amountFils) },
        { label: 'Total with VAT', num: true, cell: (entry) => formatAed(entry.totalFils) },
      ],
    };
  }, [overview.deals, overview.references]);
  return <EntriesPage kind="payments" view={view} />;
}
