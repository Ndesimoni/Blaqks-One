import React from 'react';
import { readableDate } from '../../../lib/dates.js';
import { formatAed } from '../../../lib/finance/money.js';
import { rowFigures } from './DealMoney.jsx';
import { PaymentChip } from './DealChips.jsx';

/**
 * The deal's headline figures, read first: agreed value, net fee and the caller's figure
 * (the company share in team view, "Your commission" in the own view), with the estimate or
 * earned state and what has been received. All values come from the server-shaped deal.
 */
export function DealSummary({ deal, team }) {
  const figures = rowFigures(deal, team);
  const estimate = figures.estimate;
  return (
    <section className="deal-summary" aria-label="Deal summary" data-estimate={estimate}>
      <dl className="deal-summary-figures">
        <div>
          <dt>Agreed value</dt>
          <dd className="finance-money">{formatAed(deal.agreedValueFils)}</dd>
        </div>
        <div>
          <dt>Net fee</dt>
          <dd className="finance-money">{figures.net}</dd>
        </div>
        <div className="deal-summary-key">
          <dt>{team ? 'Company share' : 'Your commission'}</dt>
          <dd className="finance-money">{figures.share}</dd>
        </div>
      </dl>
      <p className="deal-summary-state">
        {!deal.calculation
          ? 'Figures appear once the fee terms are complete.'
          : estimate
            ? 'Estimate — final figures are fixed when the deal is earned.'
            : `Earned ${readableDate(deal.earnedOn)} — figures are fixed.`}
      </p>
      <dl className="deal-summary-payments">
        <div>
          <dt>Payment</dt>
          <dd>
            <PaymentChip status={deal.paymentStatus} />
          </dd>
        </div>
        <div>
          <dt>Received</dt>
          <dd className="finance-money">{formatAed(deal.receivedFils)}</dd>
        </div>
        <div>
          <dt>Outstanding</dt>
          <dd className="finance-money">{formatAed(deal.outstandingFils)}</dd>
        </div>
      </dl>
    </section>
  );
}
