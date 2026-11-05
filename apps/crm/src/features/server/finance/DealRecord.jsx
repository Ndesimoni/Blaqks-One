import React from 'react';
import { useFinanceContext } from './useFinanceRequests.js';
import { referenceName } from './dealFilters.js';
import { Money, rowFigures } from './DealMoney.jsx';
import { StageChip } from './DealChips.jsx';

/**
 * The deal an action dialog changes, in the same record strip the payment decisions use: ID,
 * stage, client and type on the left; the caller's figure (company share or own commission)
 * on the right. `money={false}` hides the figure.
 */
export function DealRecord({ deal, money = true }) {
  const { overview, team } = useFinanceContext();
  const client = referenceName(overview.references, 'Clients', deal.clientId) ?? deal.clientId;
  const figures = rowFigures(deal, team);
  return (
    <div className="finance-dialog-record deal-record" role="group" aria-label="Deal being changed">
      <div>
        <span className="deal-record-id">
          <strong className="mono">{deal.dealId}</strong>
          <StageChip stage={deal.stage} />
        </span>
        <span className="finance-sub">
          {client} · {deal.dealType}
        </span>
      </div>
      {money && (
        <div className="finance-dialog-record-side">
          <span className="finance-sub">{team ? 'Company share' : 'Your commission'}</span>
          <Money value={figures.share} estimate={figures.estimate} />
        </div>
      )}
    </div>
  );
}
