import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { useMarketActivity } from './useMarketActivity.js';
import { MarketplaceRequestActivity } from './MarketplaceRequestActivity.jsx';

const labels = {
  selected_other: 'notificationSelected',
  request_paused: 'notificationSelected',
  reopened: 'notificationReopened',
  request_reopened: 'notificationReopened',
  new_message: 'notificationMessage',
  new_answer: 'notificationOffer',
};

/** Persistent request updates keep off-board or paused participation reachable. */
export function MarketplaceNotifications() {
  const { t, format } = useI18n();
  const k = (key) => t(`marketplaceAnswers.${key}`);
  const list = useMarketActivity('marketplaceNotifications');
  const activity = useMarketActivity('marketplaceActivity');
  const [requestId, setRequestId] = useState('');
  return (
    <section className="market-updates" aria-label={k('notifications')}>
      <div className="market-actions">
        <Button
          variant="light"
          onClick={() => {
            list.reload();
            activity.reload();
          }}
          disabled={list.loading || activity.loading}
        >
          {k('refresh')}
        </Button>
      </div>
      {list.loading && <p role="status">{k('loading')}</p>}
      {list.error && <p role="alert">{list.error}</p>}
      {activity.error && <p role="alert">{activity.error}</p>}
      <ul className="market-request-list">
        {(activity.value?.requests || []).map((request) => (
          <li className="market-card" key={request.id}>
            <strong>{request.propertyType}</strong>
            <p>
              {request.state === 'paused'
                ? k('paused')
                : t(`marketplaceRequests.mine.state.${request.state}`)}
            </p>
            <Button variant="light" onClick={() => setRequestId(request.requestId || request.id)}>
              {k('open')}
            </Button>
          </li>
        ))}
      </ul>
      {!list.loading && !list.value?.notifications?.length && <p>{k('noNotifications')}</p>}
      <ul className="market-request-list">
        {(list.value?.notifications || []).map((notice) => (
          <li className="market-card" key={notice.id}>
            <p>{k(labels[notice.kind] || 'notificationOther')}</p>
            <time dateTime={notice.createdAt}>{format.date(notice.createdAt)}</time>
            <Button variant="light" onClick={() => setRequestId(notice.requestId)}>
              {k('openUpdate')}
            </Button>
          </li>
        ))}
      </ul>
      {requestId && (
        <MarketplaceRequestActivity requestId={requestId} onClose={() => setRequestId('')} />
      )}
    </section>
  );
}
