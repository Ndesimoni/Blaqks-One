import React from 'react';
import { formatAed } from '../../../lib/finance/money.js';
import { entryCode } from './entryFilters.js';
import { StatusChip } from './StatusChip.jsx';

/**
 * The phone-width payments or expenses list. Each card is one bordered unit: the open button
 * (ID, status, title, date, amount) and, inside the same card, the decisions the row allows.
 */
export function EntryCards({ rows, label, view, onOpen, decide }) {
  return (
    <ul className="deal-cards entry-cards" aria-label={label}>
      {rows.map((entry) => (
        <li key={entry.id} className="deal-card entry-card" data-status={entry.status}>
          <button
            type="button"
            aria-label={`Open ${entryCode(entry)}`}
            onClick={() => onOpen(entry)}
          >
            <span className="deal-card-top">
              <strong className="mono entry-card-code">{entryCode(entry)}</strong>
              <StatusChip status={entry.status} />
            </span>
            <span className="deal-card-client">{view.title(entry)}</span>
            <span className="entry-card-foot">
              <span className="deal-card-meta">{view.date(entry)}</span>
              <span className="finance-money entry-card-amount">{formatAed(entry.amountFils)}</span>
            </span>
            {entry.reason && entry.status !== 'pending' && (
              <span className="deal-card-meta finance-reason entry-card-reason">
                Reason: {entry.reason}
              </span>
            )}
          </button>
          <div className="entry-card-decisions">{decide(entry)}</div>
        </li>
      ))}
    </ul>
  );
}
