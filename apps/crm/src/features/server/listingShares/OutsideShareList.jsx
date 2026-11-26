import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { OverflowList } from '../../../components/ui/OverflowList.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { ListingShareDetail } from './ListingShareDetail.jsx';

/** The latest moment a share changed: closed, answered or sent. */
export const changedAt = (share) => share.closedAt || share.decidedAt || share.createdAt;

/**
 * One listing's outside shares, newest first, each with its agent, company, status and
 * date. Details opens the share, where its sender withdraws, stops, extends or downloads
 * the evidence; the list reloads after any change there.
 */
export function OutsideShareList({ state }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`listingShareViews.${key}`, vars);
  const [openId, setOpenId] = useState(null);
  return (
    <div className="record-share-history">
      {state.loading && !state.value && <p role="status">{k('loading')}</p>}
      {state.error && !state.value && (
        <p className="field-error" role="alert">
          {k('loadFailed')}
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
                <strong>
                  {k('sharedWith', {
                    name: share.to.name || k('someone'),
                    company: share.to.company || k('otherCompany'),
                  })}
                </strong>
                <small>
                  {k('since', {
                    status: k(`status.${share.status}`),
                    date: format.dateTime(changedAt(share)),
                  })}
                </small>
              </div>
              <Button
                variant="light"
                className="record-share-step"
                aria-label={k('detailsLabel', { reference: share.reference })}
                onClick={() => setOpenId(share.id)}
              >
                {k('details')}
              </Button>
            </div>
          )}
        />
      )}
      {openId && (
        <ListingShareDetail id={openId} onChanged={state.reload} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
