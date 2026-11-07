import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceAvatar } from './MarketplaceAvatar.jsx';
import { MarketplaceRequestTags } from './MarketplaceRequestTags.jsx';
import { MarketplaceStats } from './MarketplaceStats.jsx';
import { requestLine, requestTitle } from './requestText.js';

/**
 * One request on the board (packet MK2, marketplace redesign): what the client wants as a
 * title, buying or renting with the budget band, the areas and preferences as tags, the dates
 * and the broker with their facts. A colleague's request carries a "Your company" chip
 * (owner, 2026-10-24) and no answer button: answering is for other companies only.
 */
export function MarketplaceBoardCard({ request, onOpenBroker, onOpenRequest }) {
  const { t, format } = useI18n();
  const posted = format.date(request.createdAt) || request.createdAt;
  const ends = format.date(request.expiresAt) || request.expiresAt;
  return (
    <li className="market-card market-board-card">
      <div className="market-card-head">
        <h3>{requestTitle(t, request)}</h3>
        {request.yourCompany && (
          <span className="market-chip is-own">{t('marketplaceRequests.board.yourCompany')}</span>
        )}
      </div>
      <p className="market-card-line">{requestLine(t, request)}</p>
      <MarketplaceRequestTags request={request} />
      {request.hasMatches === true && (
        <p className="market-match-alert" role="status">
          {t('marketplaceAnswers.matchAlert')}
        </p>
      )}
      <p className="market-hint">{t('marketplaceRequests.board.posted', { posted, ends })}</p>
      <div className="market-card-broker">
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
        <MarketplaceStats stats={request.broker.stats} compact />
      </div>
      {!request.yourCompany && (
        <div className="market-actions">
          <Button onClick={onOpenRequest}>{t('marketplaceAnswers.open')}</Button>
        </div>
      )}
    </li>
  );
}
