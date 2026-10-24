import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/** The renew button is offered in the last seven days, or once the request has expired. */
const renewSoon = (request) => {
  if (request.state === 'expired') return request.canRenew;
  if (request.state !== 'open') return false;
  const left = Date.parse(request.expiresAt) - Date.now();
  return request.canRenew && left <= 7 * 86_400_000;
};

/** One of the poster's own requests, with what they may do next (packet MK2). */
export function MarketplaceRequestRow({ request, busy, onEdit, onRenew, onClose }) {
  const { t, format } = useI18n();
  const ends = format.date(request.expiresAt) || request.expiresAt;
  const renewable = renewSoon(request);
  return (
    <li className={`market-card market-request-row is-${request.state}`}>
      <div className="market-card-head">
        <h4>{request.propertyType}</h4>
        <span className={`market-chip is-${request.state}`}>
          {t(`marketplaceRequests.mine.state.${request.state}`)}
        </span>
      </div>
      <p className="market-facts-line">
        {request.clientName
          ? t('marketplaceRequests.mine.client', { name: request.clientName })
          : t('marketplaceRequests.mine.clientGone')}
      </p>
      <p className="market-facts-line">
        {t(`marketplaceRequests.board.purpose.${request.purpose}`)} ·{' '}
        {t(`marketplaceJoin.emirate.${request.emirate}`)} ·{' '}
        {t(`marketplaceRequests.band.${request.budgetBand}`)}
      </p>
      <p className="market-hint">{t('marketplaceRequests.mine.ends', { date: ends })}</p>
      <p className="market-hint">{t('marketplaceRequests.mine.noAnswers')}</p>
      {request.state === 'open' && (
        <div className="market-actions">
          <Button variant="light" onClick={onEdit} disabled={Boolean(busy)}>
            {t('marketplaceRequests.mine.edit')}
          </Button>
          <Button variant="light" onClick={onClose} disabled={Boolean(busy)}>
            {t('marketplaceRequests.mine.close')}
          </Button>
          {renewable && (
            <Button variant="light" onClick={onRenew} disabled={Boolean(busy)}>
              {busy === 'renew'
                ? t('marketplaceRequests.post.saving')
                : t('marketplaceRequests.mine.renew')}
            </Button>
          )}
        </div>
      )}
      {request.state === 'expired' && request.canRenew && (
        <div className="market-actions">
          <Button onClick={onRenew} disabled={Boolean(busy)}>
            {t('marketplaceRequests.mine.renew')}
          </Button>
          <Button variant="light" onClick={onClose} disabled={Boolean(busy)}>
            {t('marketplaceRequests.mine.close')}
          </Button>
        </div>
      )}
    </li>
  );
}
