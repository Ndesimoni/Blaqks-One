import React from 'react';
import { readableDate } from '../../../lib/dates.js';
import { formatAed } from '../../../lib/finance/money.js';
import { holderName } from './dealFilters.js';
import { Money, rowFigures } from './DealMoney.jsx';
import { PaymentChip, StageChip } from './DealChips.jsx';

/**
 * The phone-width deal list: one card per deal, each a single button that opens it. The
 * card reads top to bottom: the deal's name and stage, client and value (as the mockup's
 * cards), ID, type and holder, then the caller's figure (own commission or company share)
 * with its estimate/earned state and payment chip.
 */
export function DealCards({ rows, team, me, title, client, shareLabel, onOpen }) {
  return (
    <ul className="deal-cards deal-card-list" aria-label="Deals">
      {rows.map((deal) => {
        const figures = rowFigures(deal, team);
        return (
          <li key={deal.id} className="deal-card" data-earned={deal.earnedOn ? 'true' : 'false'}>
            <button
              type="button"
              aria-label={`Open deal ${deal.dealId}`}
              onClick={() => onOpen(deal)}
            >
              <span className="deal-card-top">
                <strong className="deal-card-title">{title(deal)}</strong>
                <StageChip stage={deal.stage} />
              </span>
              <span className="deal-card-line">
                <span className="deal-card-client">{client(deal)}</span>
                <strong className="deal-card-value">{formatAed(deal.agreedValueFils)}</strong>
              </span>
              <span className="deal-card-meta">
                <span className="mono">{deal.dealId}</span> · {deal.dealType}
                {team ? ` · ${holderName(deal.assignee, me)}` : ''}
              </span>
              <span className="deal-card-money">
                <span className="deal-card-money-label">{shareLabel}</span>
                <Money value={figures.share} estimate={figures.estimate} />
              </span>
              <span className="deal-card-foot">
                <PaymentChip status={deal.paymentStatus} />
                {deal.earnedOn && (
                  <span className="deal-card-meta">Earned {readableDate(deal.earnedOn)}</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
