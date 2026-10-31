import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';

/** Closing a request, confirmed in a dialog sized like the MK1 leave one (packet MK2). */
export function MarketplaceRequestClose({ request, onClose, onClosed }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = async () => {
    setBusy(true);
    setError('');
    try {
      await api.closeMarketplaceRequest(user.workspaceId, request.id);
      onClosed();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <FinanceDialog title={t('marketplaceRequests.mine.closeTitle')} onClose={onClose}>
      <p>{t('marketplaceRequests.mine.closeText')}</p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="market-actions">
        <Button variant="light" onClick={onClose} disabled={busy}>
          {t('marketplaceRequests.mine.keepOpen')}
        </Button>
        <Button onClick={close} disabled={busy}>
          {busy
            ? t('marketplaceRequests.mine.closing')
            : t('marketplaceRequests.mine.closeConfirm')}
        </Button>
      </div>
    </FinanceDialog>
  );
}
