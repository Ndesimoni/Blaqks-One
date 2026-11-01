import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { useMarketActivity } from './useMarketActivity.js';
import { MarketplaceRequestActivity } from './MarketplaceRequestActivity.jsx';
import { readSummary } from './requestSummary.js';
import { requestTitle } from './requestText.js';
import './marketplace-updates.css';

const labels = {
  selected_other: 'notificationSelected',
  request_paused: 'notificationSelected',
  reopened: 'notificationReopened',
  request_reopened: 'notificationReopened',
  new_message: 'notificationMessage',
  new_answer: 'notificationOffer',
};

/**
 * Persistent request updates keep off-board or paused participation reachable: the requests
 * the member offered on or asked about, then a feed of recent updates.
 */
export function MarketplaceNotifications() {
  const { t, format } = useI18n();
  const k = (key) => t(`marketplaceAnswers.${key}`);
  const list = useMarketActivity('marketplaceNotifications');
  const activity = useMarketActivity('marketplaceActivity');
  const [requestId, setRequestId] = useState('');
  const requests = activity.value?.requests || [];
  const notices = list.value?.notifications || [];
  const opened = requests.find((request) => (request.requestId || request.id) === requestId);
  const summary = readSummary(opened);
  return (
    <section className="market-updates" aria-label={k('notifications')}>
      <div className="market-toolbar">
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
      {requests.length > 0 && <h3 className="market-subhead">{k('involved')}</h3>}
      <ul className="market-feed">
        {requests.map((request) => {
          const facts = readSummary(request);
          return (
            <li className="market-feed-row" key={request.id}>
              <span className="market-feed-icon" aria-hidden="true">
                <Icon name="layers" size={18} />
              </span>
              <div>
                <strong>{facts ? requestTitle(t, facts) : request.propertyType}</strong>
                <p>
                  {request.state === 'paused'
                    ? k('paused')
                    : t(`marketplaceRequests.mine.state.${request.state}`)}
                </p>
              </div>
              <Button variant="light" onClick={() => setRequestId(request.requestId || request.id)}>
                {k('open')}
              </Button>
            </li>
          );
        })}
      </ul>
      <h3 className="market-subhead">{k('recent')}</h3>
      {!list.loading && !notices.length && <p className="market-empty">{k('noNotifications')}</p>}
      <ul className="market-feed">
        {notices.map((notice) => (
          <li className="market-feed-row" key={notice.id}>
            <span className="market-feed-icon" aria-hidden="true">
              <Icon name="bell" size={18} />
            </span>
            <div>
              <p>{k(labels[notice.kind] || 'notificationOther')}</p>
              <time dateTime={notice.createdAt}>{format.date(notice.createdAt)}</time>
            </div>
            <Button variant="light" onClick={() => setRequestId(notice.requestId)}>
              {k('openUpdate')}
            </Button>
          </li>
        ))}
      </ul>
      {requestId && (
        <MarketplaceRequestActivity
          requestId={requestId}
          summary={summary}
          onClose={() => setRequestId('')}
        />
      )}
    </section>
  );
}
