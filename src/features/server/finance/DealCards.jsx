import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { readableDate } from '../../../lib/dates.js';
import { holderName } from './dealFilters.js';
import { Money, rowFigures } from './DealMoney.jsx';

/** The phone-width deal list: one card per deal, each a single button that opens it. */
export function DealCards({ rows, team, me, client, shareLabel, onOpen }) {
  return (
    <ul className="deal-cards" aria-label="Deals">
      {rows.map((deal) => {
        const figures = rowFigures(deal, team);
        return (
          <li key={deal.id} className="deal-card">
            <button
              type="button"
              aria-label={`Open deal ${deal.dealId}`}
              onClick={() => onOpen(deal)}
            >
              <span className="deal-card-top">
                <strong className="mono">{deal.dealId}</strong>
                <Badge>{deal.stage}</Badge>
              </span>
              <span className="deal-card-client">{client(deal)}</span>
              <span className="deal-card-meta">
                {deal.dealType} ·{' '}
                {deal.earnedOn ? `Earned ${readableDate(deal.earnedOn)}` : 'Not earned'}
                {team ? ` · ${holderName(deal.assignee, me)}` : ''}
              </span>
              <span className="deal-card-money">
                <span>{shareLabel}</span>
                <Money value={figures.share} estimate={figures.estimate} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
