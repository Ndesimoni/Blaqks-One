import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceAvatar } from './MarketplaceAvatar.jsx';
import { MarketplaceRequestFacts } from './MarketplaceRequestFacts.jsx';

/**
 * One request on the board: the facts, the band as a chip, the dates and the broker (packet
 * MK2). A colleague's request carries a "Your company" chip (owner, 2026-10-24).
 */
export function MarketplaceBoardCard({ request, onOpenBroker }) {
  const { t, format } = useI18n();
  const posted = format.date(request.createdAt) || request.createdAt;
  const ends = format.date(request.expiresAt) || request.expiresAt;
  return (
    <li className="market-card market-board-card">
      <div className="market-card-head">
        <h4>{request.propertyType}</h4>
        <span className="market-chips">
          {request.yourCompany && (
            <span className="market-chip is-own">{t('marketplaceRequests.board.yourCompany')}</span>
          )}
          <span className="market-chip">{t(`marketplaceRequests.band.${request.budgetBand}`)}</span>
        </span>
      </div>
      <MarketplaceRequestFacts request={request} />
      {request.openToOtherAreas && (
        <p className="market-hint">{t('marketplaceRequests.board.otherAreas')}</p>
      )}
      <p className="market-hint">{t('marketplaceRequests.board.posted', { posted, ends })}</p>
      <button
        type="button"
        className="market-broker"
        onClick={() => onOpenBroker(request.broker.memberId)}
        aria-label={t('marketplaceRequests.board.viewBroker', { name: request.broker.name })}
      >
        <MarketplaceAvatar name={request.broker.name} src="" />
        <span>
          <strong>{request.broker.name}</strong>
          <span>{request.broker.company}</span>
        </span>
      </button>
    </li>
  );
}
