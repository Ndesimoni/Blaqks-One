import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';
import { MarketplaceRequestForm } from './MarketplaceRequestForm.jsx';
import { draftFromRequest, problemOf, requestBodyOf } from './requestOptions.js';

/** Edit one of the poster's own open requests, with the version they last saw (packet MK2). */
export function MarketplaceRequestEdit({ request, onClose, onSaved }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => draftFromRequest(request));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const problem = problemOf(draft);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.editMarketplaceRequest(user.workspaceId, request.id, {
        expectedVersion: request.version,
        request: requestBodyOf(draft),
      });
      onSaved();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <FinanceDialog title={t('marketplaceRequests.post.editTitle')} onClose={onClose}>
      <MarketplaceRequestForm draft={draft} onChange={setDraft} prefix="market-edit" />
      {problem && (
        <p className="field-error" role="alert">
          {t(`marketplaceRequests.post.${problem}`)}
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="market-actions">
        <Button variant="light" onClick={onClose} disabled={busy}>
          {t('marketplaceRequests.post.back')}
        </Button>
        <Button onClick={save} disabled={busy || Boolean(problem)}>
          {busy ? t('marketplaceRequests.post.saving') : t('marketplaceRequests.post.save')}
        </Button>
      </div>
    </FinanceDialog>
  );
}
