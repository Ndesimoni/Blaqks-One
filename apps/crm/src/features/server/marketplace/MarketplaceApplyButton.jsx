import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';

/** The Admin's Apply button; the server decides whether the checklist and dates allow it. */
export function MarketplaceApplyButton({ onApplied }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      await api.applyToMarketplace(user.workspaceId);
      onApplied();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button onClick={apply} disabled={busy}>
        {busy ? t('marketplace.notApplied.applying') : t('marketplace.notApplied.apply')}
      </Button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
