import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { OverflowList } from '../../../components/ui/OverflowList.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { useShareActions } from './useShareActions.js';

/** The latest moment a share changed: closed, answered or sent. */
const changedAt = (share) => share.closedAt || share.decidedAt || share.createdAt;

/**
 * One record's shares, newest first, each with its colleague, status and date. Withdraw (a
 * pending offer) and Stop sharing (an accepted copy, which the colleague then loses) follow
 * the server's `allowed` flags; a refused step shows the server's reason and reloads.
 */
export function RecordShareList({ state }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`recordShares.${key}`, vars);
  const { busy, decide } = useShareActions();
  const [notice, setNotice] = useState(null);
  const act = async (share, action) => {
    setNotice(null);
    const result = await decide(share, action);
    const name = share.to.name;
    if (result.ok)
      setNotice({ role: 'status', text: k(action === 'stop' ? 'stopped' : 'withdrawn', { name }) });
    else if (result.message) setNotice({ role: 'alert', text: result.message });
    state.reload();
  };
  const step = (share, action) =>
    share.allowed[action] && (
      <Button
        variant="light"
        className="record-share-step"
        disabled={Boolean(busy)}
        aria-label={k(`${action}Label`, { name: share.to.name })}
        onClick={() => act(share, action)}
      >
        {k(action)}
      </Button>
    );
  return (
    <div className="record-share-history">
      {state.loading && !state.value && <p role="status">{k('loadingShares')}</p>}
      {state.error && !state.value && (
        <p className="field-error" role="alert">
          {k('sharesFailed')}
        </p>
      )}
      {notice && (
        <p
          className={notice.role === 'alert' ? 'field-error' : 'record-share-done'}
          role={notice.role}
        >
          {notice.text}
        </p>
      )}
      {state.shares.length > 0 && (
        <OverflowList
          items={state.shares}
          label={k('listLabel')}
          getKey={(share) => share.id}
          listClassName="record-share-items"
          renderItem={(share) => (
            <div className="record-share-item">
              <div className="record-share-text">
                <strong>{k('sharedWith', { name: share.to.name })}</strong>
                <small>
                  {k('since', {
                    status: k(`status.${share.status}`),
                    date: format.dateTime(changedAt(share)),
                  })}
                </small>
              </div>
              {step(share, 'withdraw')}
              {step(share, 'stop')}
            </div>
          )}
        />
      )}
    </div>
  );
}
