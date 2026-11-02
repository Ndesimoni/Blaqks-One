import React, { useId } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { readableDate } from '../../../lib/dates.js';
import { formatAed } from '../../../lib/finance/money.js';
import '../../records/panel/record-panel-cards.css';
import { PaymentChip } from './DealChips.jsx';
import { StatusChip } from './StatusChip.jsx';
import { useFinanceContext } from './useFinanceRequests.js';

/**
 * The deal's payments card (approved mockup): what has been received of the fee due, then
 * each payment recorded against the deal with its amount and approval, newest first. Rows come
 * from the caller's shaped overview, so a view without payments lists none.
 */
export function DealPaymentsCard({ deal }) {
  const { t } = useI18n();
  const { overview } = useFinanceContext();
  const k = (key, vars) => t(`dealPanel.${key}`, vars);
  const headingId = useId();
  const rows = (overview.payments || [])
    .filter((payment) => payment.dealId === deal.dealId)
    .sort((a, b) => b.receiptDate.localeCompare(a.receiptDate));
  const due = BigInt(deal.receivedFils) + BigInt(deal.outstandingFils);
  return (
    <section className="record-mini-card deal-payments" aria-labelledby={headingId}>
      <div className="record-mini-head">
        <h3 id={headingId}>{k('payments')}</h3>
        {deal.earnedOn ? (
          <span>
            {k('received', { received: formatAed(deal.receivedFils), due: formatAed(due) })}
          </span>
        ) : (
          <PaymentChip status={deal.paymentStatus} />
        )}
      </div>
      {rows.length ? (
        <ul className="record-mini-list">
          {rows.map((payment) => (
            <li key={payment.id}>
              <span>
                {readableDate(payment.receiptDate)}
                {payment.reference ? ` · ${payment.reference}` : ''}
              </span>
              <span className="deal-payment-amount">
                <span className="finance-money">{formatAed(payment.amountFils)}</span>
                <StatusChip status={payment.status} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="record-mini-empty">{k(deal.earnedOn ? 'paymentsNone' : 'paymentsLater')}</p>
      )}
    </section>
  );
}
