import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceRequestClose } from './MarketplaceRequestClose.jsx';
import { MarketplaceRequestEdit } from './MarketplaceRequestEdit.jsx';
import { MarketplaceRequestPost } from './MarketplaceRequestPost.jsx';
import { MarketplaceRequestRow } from './MarketplaceRequestRow.jsx';
import { useMyRequests } from './useRequests.js';

/** The poster's own requests: post, edit, renew and close (packet MK2). */
export function MarketplaceRequests() {
  const { api, user } = useSession();
  const { t } = useI18n();
  const list = useMyRequests();
  const [dialog, setDialog] = useState({ name: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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

  return (
    <div className="market-requests">
      <p className="market-hint">{t('marketplaceRequests.mine.text')}</p>
      <div className="market-actions">
        <Button onClick={() => setDialog({ name: 'post' })}>
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
        <section className="market-empty">
          <h4>{t('marketplaceRequests.mine.emptyTitle')}</h4>
          <p>{t('marketplaceRequests.mine.emptyText')}</p>
        </section>
      )}
      <ul className="market-request-list">
        {list.requests.map((request) => (
          <MarketplaceRequestRow
            key={request.id}
            request={request}
            busy={busy}
            onEdit={() => setDialog({ name: 'edit', id: request.id })}
            onClose={() => setDialog({ name: 'close', id: request.id })}
            onRenew={() => renew(request)}
          />
        ))}
      </ul>
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
