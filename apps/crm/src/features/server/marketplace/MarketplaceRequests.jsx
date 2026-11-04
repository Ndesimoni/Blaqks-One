import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { GridFilterBar } from '../../records/grid/GridFilterBar.jsx';
import '../../records/grid/grid-filter.css';
import { MarketplaceRequestClose } from './MarketplaceRequestClose.jsx';
import { MarketplaceRequestEdit } from './MarketplaceRequestEdit.jsx';
import { MarketplaceRequestPost } from './MarketplaceRequestPost.jsx';
import { MarketplaceRequestRow } from './MarketplaceRequestRow.jsx';
import { requestTitle } from './requestText.js';
import { useMyRequests } from './useRequests.js';
import { MarketplaceRequestActivity } from './MarketplaceRequestActivity.jsx';

const ENDED = ['expired', 'closed'];

/**
 * The poster's own requests (packet MK2) as the approved mockup's My requests (design queue item
 * 27): Open (open, full or paused) and Closed (expired or closed), searchable; post, edit,
 * renew and close.
 */
export function MarketplaceRequests() {
  const { api, user } = useSession();
  const { t } = useI18n();
  const list = useMyRequests();
  const [dialog, setDialog] = useState({ name: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [view, setView] = useState({ ended: false, query: '' });

  const done = (message) => {
    setDialog({ name: '' });
    setError('');
    setNotice(message);
    list.retry();
  };
  const renew = async (request) => {
    setBusy('renew');
    setError('');
    try {
      await api.renewMarketplaceRequest(user.workspaceId, request.id);
      done(t('marketplaceRequests.mine.renewed'));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  };
  const editing = list.requests.find((request) => request.id === dialog.id);
  const needle = view.query.trim().toLowerCase();
  const shown = list.requests.filter(
    (request) =>
      ENDED.includes(request.state) === view.ended &&
      (!needle ||
        `${requestTitle(t, request)} ${request.clientName || ''}`.toLowerCase().includes(needle)),
  );
  const tabs = [t('marketplaceRequests.mine.openView'), t('marketplaceRequests.mine.closedView')];

  return (
    <div className="market-requests">
      <div className="market-toolbar">
        <p className="market-note">{t('marketplaceRequests.mine.text')}</p>
        <Button icon="plus" onClick={() => setDialog({ name: 'post' })}>
          {t('marketplaceRequests.mine.post')}
        </Button>
      </div>
      {notice && (
        <p className="market-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {list.loading && !list.requests.length && <p role="status">{t('marketplace.loading')}</p>}
      {list.error && (
        <p className="field-error" role="alert">
          {list.error}
        </p>
      )}
      {!list.loading && !list.error && !list.requests.length && (
        <div className="market-empty">
          <strong>{t('marketplaceRequests.mine.emptyTitle')}</strong>
          <p>{t('marketplaceRequests.mine.emptyText')}</p>
        </div>
      )}
      {list.requests.length > 0 && (
        <GridFilterBar
          module={t('marketplaceRequests.mine.module')}
          presetLabel={tabs[Number(view.ended)]}
          tabs={tabs}
          tab={tabs[Number(view.ended)]}
          onTab={(name) => setView({ ...view, ended: name === tabs[1] })}
          query={view.query}
          onQuery={(query) => setView({ ...view, query })}
        />
      )}
      {list.requests.length > 0 && !shown.length && (
        <p className="market-hint">{t('marketplaceRequests.mine.noneHere')}</p>
      )}
      <ul className="market-request-list">
        {shown.map((request) => (
          <MarketplaceRequestRow
            key={request.id}
            request={request}
            busy={busy}
            onEdit={() => setDialog({ name: 'edit', id: request.id })}
            onClose={() => setDialog({ name: 'close', id: request.id })}
            onRenew={() => renew(request)}
            onActivity={() => setDialog({ name: 'activity', id: request.id })}
          />
        ))}
      </ul>
      {dialog.name === 'activity' && editing && (
        <MarketplaceRequestActivity
          requestId={editing.id}
          summary={editing}
          onClose={() => setDialog({ name: '' })}
          onChanged={list.retry}
        />
      )}
      {dialog.name === 'post' && (
        <MarketplaceRequestPost
          onClose={() => setDialog({ name: '' })}
          onPosted={() => done(t('marketplaceRequests.post.posted'))}
        />
      )}
      {dialog.name === 'edit' && editing && (
        <MarketplaceRequestEdit
          request={editing}
          onClose={() => setDialog({ name: '' })}
          onSaved={() => done(t('marketplaceRequests.post.saved'))}
        />
      )}
      {dialog.name === 'close' && editing && (
        <MarketplaceRequestClose
          request={editing}
          onClose={() => setDialog({ name: '' })}
          onClosed={() => done(t('marketplaceRequests.mine.closed'))}
        />
      )}
    </div>
  );
}
