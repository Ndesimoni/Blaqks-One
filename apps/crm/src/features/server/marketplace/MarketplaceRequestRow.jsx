import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceRequestTags } from './MarketplaceRequestTags.jsx';
import { requestLine, requestTitle } from './requestText.js';

const TONES = { open: 'green', full: 'amber', paused: 'amber', expired: 'red', closed: 'slate' };

/** The renew button is offered in the last seven days, or once the request has expired. */
const renewSoon = (request) => {
  if (request.state === 'expired') return request.canRenew;
  if (request.state !== 'open') return false;
  const left = Date.parse(request.expiresAt) - Date.now();
  return request.canRenew && left <= 7 * 86_400_000;
};

/** One of the poster's own requests as a list row, with what they may do next (packet MK2). */
export function MarketplaceRequestRow({ request, busy, onEdit, onRenew, onClose, onActivity }) {
  const { t, format } = useI18n();
  const ends = format.date(request.expiresAt) || request.expiresAt;
  const renewable = renewSoon(request);
  const waiting = Boolean(busy);
  return (
    <li className={`market-card market-request-row is-${request.state}`}>
      <div className="market-request-main">
        <div className="market-card-head">
          <h3>{requestTitle(t, request)}</h3>
          <Badge tone={TONES[request.state]}>
            {t(`marketplaceRequests.mine.state.${request.state}`)}
          </Badge>
        </div>
        <p className="market-card-line">{requestLine(t, request)}</p>
        <p className="market-row-client">
          {request.clientName
            ? t('marketplaceRequests.mine.client', { name: request.clientName })
            : t('marketplaceRequests.mine.clientGone')}
        </p>
        <MarketplaceRequestTags request={request} />
        <p className="market-hint">{t('marketplaceRequests.mine.ends', { date: ends })}</p>
      </div>
      <div className="market-actions market-request-actions">
        <Button variant={request.state === 'expired' ? 'light' : 'primary'} onClick={onActivity}>
          {t('marketplaceAnswers.open')}
        </Button>
        {request.state === 'open' && (
          <Button variant="light" onClick={onEdit} disabled={waiting}>
            {t('marketplaceRequests.mine.edit')}
          </Button>
        )}
        {request.state === 'expired' && request.canRenew && (
          <Button onClick={onRenew} disabled={waiting}>
            {t('marketplaceRequests.mine.renew')}
          </Button>
        )}
        {['open', 'paused', 'expired'].includes(request.state) && (
          <Button variant="light" onClick={onClose} disabled={waiting}>
            {t('marketplaceRequests.mine.close')}
          </Button>
        )}
        {request.state === 'open' && renewable && (
          <Button variant="light" onClick={onRenew} disabled={waiting}>
            {busy === 'renew'
              ? t('marketplaceRequests.post.saving')
              : t('marketplaceRequests.mine.renew')}
          </Button>
        )}
      </div>
    </li>
  );
}
