import React from 'react';
import { readableDate } from '../../../lib/dates.js';
import { formatAed } from '../../../lib/finance/money.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { PaymentChip } from './DealChips.jsx';
import { dealTitle, holderName, referenceName } from './dealFilters.js';
import { Money, rowFigures } from './DealMoney.jsx';
import { useFinanceContext } from './useFinanceRequests.js';

/**
 * A deal on the pipeline, as the mockup's card: its name (listing and type), then client and
 * value; below them our ID and holder, the caller's figure (company share for the team view,
 * own commission otherwise) and its payment state. The whole body opens the deal.
 */
export function DealCardBody({ deal, onOpen }) {
  const { t } = useI18n();
  const { team, overview, user } = useFinanceContext();
  const figures = rowFigures(deal, team);
  const client = referenceName(overview.references, 'Clients', deal.clientId) ?? deal.clientId;
  return (
    <button
      type="button"
      className="deal-board-card"
      aria-label={t('dealsBoard.open', { id: deal.dealId, client })}
      onClick={onOpen}
    >
      <strong className="deal-board-title">{dealTitle(deal, overview.references)}</strong>
      <span className="deal-board-line">
        <span>{client}</span>
        <span className="deal-board-value">{formatAed(deal.agreedValueFils)}</span>
      </span>
      <span className="deal-board-meta">
        <span className="mono">{deal.dealId}</span>
        {team ? ` · ${holderName(deal.assignee, user?.id)}` : ''}
      </span>
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
