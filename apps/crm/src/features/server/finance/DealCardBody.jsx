import React from 'react';
import { readableDate } from '../../../lib/dates.js';
import { formatAed } from '../../../lib/finance/money.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { PaymentChip } from './DealChips.jsx';
import { holderName, referenceName } from './dealFilters.js';
import { Money, rowFigures } from './DealMoney.jsx';
import { useFinanceContext } from './useFinanceRequests.js';

/**
 * A deal on the pipeline: its ID, client, type and holder, the caller's figure (company
 * share for the team view, own commission otherwise) and its payment state. The whole body
 * opens the deal, with the same name the list uses.
 */
export function DealCardBody({ deal, onOpen }) {
  const { t } = useI18n();
  const { team, overview, user } = useFinanceContext();
  const figures = rowFigures(deal, team);
  const client = referenceName(overview.references, 'Clients', deal.clientId) ?? deal.clientId;
  const property = referenceName(overview.references, 'Properties', deal.propertyId);
  return (
    <button
      type="button"
      className="deal-board-card"
      aria-label={t('dealsBoard.open', { id: deal.dealId, client })}
      onClick={onOpen}
    >
      <span className="mono deal-board-code">{deal.dealId}</span>
      <strong className="deal-board-client">{property || client}</strong>
      {property && <span className="deal-board-meta">{client}</span>}
      <span className="deal-board-meta">
        {deal.dealType}
        {team ? ` · ${holderName(deal.assignee, user?.id)}` : ''}
      </span>
      <strong className="deal-board-value">{formatAed(deal.agreedValueFils)}</strong>
      <span className="deal-board-money">
        <span>{team ? t('dealsBoard.companyShare') : t('dealsBoard.yourCommission')}</span>
        <Money value={figures.share} estimate={figures.estimate} />
      </span>
      <span className="deal-board-foot">
        <PaymentChip status={deal.paymentStatus} />
        {deal.earnedOn && (
          <span className="deal-board-meta">
            {t('dealsBoard.earned', { date: readableDate(deal.earnedOn) })}
          </span>
        )}
      </span>
    </button>
  );
}
