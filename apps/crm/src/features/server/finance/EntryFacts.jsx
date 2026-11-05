import React from 'react';
import { readableDate } from '../../../lib/dates.js';
import { formatAed } from '../../../lib/finance/money.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { referenceName } from './dealFilters.js';
import { ReceiptLink } from './ReceiptLink.jsx';

export function Fact({ label, children, wide = false }) {
  return (
    <div className={'finance-fact' + (wide ? ' wide' : '')}>
      <dt>{label}</dt>
      <dd>{children || '—'}</dd>
    </div>
  );
}

/**
 * The record's money, read like an invoice: amounts right-aligned in tabular figures with the
 * total emphasised. Payments show their VAT breakdown; expenses show the single amount.
 */
export function EntryAmount({ kind, entry }) {
  const rows =
    kind === 'payments'
      ? [
          ['Amount (excluding VAT)', entry.amountFils],
          ['VAT', entry.vatFils],
          ['Total with VAT', entry.totalFils],
        ]
      : [['Amount', entry.amountFils]];
  return (
    <dl
      className={`finance-amount-card${rows.length > 1 ? ' is-breakdown' : ''}`}
      data-status={entry.status}
    >
      {rows.map(([label, value]) => (
        <div key={label} className="finance-amount-row">
          <dt>{label}</dt>
          <dd className="finance-money">{formatAed(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Facts for one payment or expense in the caller's shaped view (money is in EntryAmount). */
export function EntryFacts({ kind, entry }) {
  const { overview } = useFinanceContext();
  const property = referenceName(overview.references, 'Properties', entry.propertyId);
  if (kind === 'payments')
    return (
      <>
        <Fact label="Deal">{entry.dealId}</Fact>
        <Fact label="Receipt date">{readableDate(entry.receiptDate)}</Fact>
        <Fact label="Reference">{entry.reference}</Fact>
      </>
    );
  return (
    <>
      <Fact label="Incurred by">{entry.incurredBy.name}</Fact>
      <Fact label="Date paid">{readableDate(entry.datePaid)}</Fact>
      <Fact label="Category">{entry.category}</Fact>
      <Fact label="Supplier">{entry.supplier}</Fact>
      <Fact label="Campaign reference">{entry.campaignReference}</Fact>
      <Fact label="Property">
        {entry.propertyId && (property ? `${property} (${entry.propertyId})` : entry.propertyId)}
      </Fact>
      <Fact label="Receipt" wide>
        <ReceiptLink url={entry.receiptUrl} />
      </Fact>
    </>
  );
}
