import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';
import { MarketplaceRequestClientPicker } from './MarketplaceRequestClientPicker.jsx';
import { MarketplaceRequestForm } from './MarketplaceRequestForm.jsx';
import { MarketplaceRequestReview } from './MarketplaceRequestReview.jsx';
import { problemOf, requestBodyOf } from './requestOptions.js';
import { useDraft } from './useRequests.js';

/** Pick a client, review the pre-filled request, tick the consent and post it (packet MK2). */
export function MarketplaceRequestPost({ onClose, onPosted }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const [clientId, setClientId] = useState('');
  const [draft, setDraft] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const found = useDraft(clientId);
  useEffect(() => {
    if (found.draft) setDraft(found.draft);
  }, [found.draft]);
  const problem = draft ? problemOf(draft) : 'required';
  const post = async () => {
    setBusy(true);
    setError('');
    try {
      await api.postMarketplaceRequest(user.workspaceId, {
        clientId,
        request: requestBodyOf(draft),
        clientConsent: consent,
      });
      onPosted();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const back = () => {
    setClientId('');
    setDraft(null);
    setConsent(false);
    setError('');
  };
  return (
    <FinanceDialog title={t('marketplaceRequests.post.title')} onClose={onClose}>
      {!clientId && <MarketplaceRequestClientPicker onPick={setClientId} />}
      {clientId && found.loading && <p role="status">{t('marketplaceRequests.post.picking')}</p>}
      {clientId && found.error && (
        <>
          <p className="field-error" role="alert">
            {found.error}
          </p>
          <div className="market-actions">
            <Button variant="light" onClick={back}>
              {t('marketplaceRequests.post.changeClient')}
            </Button>
          </div>
        </>
      )}
      {clientId && draft && (
        <>
          <MarketplaceRequestForm draft={draft} onChange={setDraft} prefix="market-post" />
          <MarketplaceRequestReview draft={draft} />
          {problem && (
            <p className="field-error" role="alert">
              {t(`marketplaceRequests.post.${problem}`)}
            </p>
          )}
          <label className="market-check market-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            {t('marketplaceRequests.post.consent')}
          </label>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="market-actions">
            <Button variant="light" onClick={back} disabled={busy}>
              {t('marketplaceRequests.post.changeClient')}
            </Button>
            <Button onClick={post} disabled={busy || !consent || Boolean(problem)}>
              {busy ? t('marketplaceRequests.post.posting') : t('marketplaceRequests.post.post')}
            </Button>
          </div>
        </>
      )}
    </FinanceDialog>
  );
}
