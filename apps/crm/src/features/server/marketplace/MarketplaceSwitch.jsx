import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * The company switch (review amendment 2): the Admin turns the marketplace on or off for the
 * whole company. The server repeats the version so a stale screen cannot overwrite a change.
 */
export function MarketplaceSwitch({ company, onChanged }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      await api.setMarketplaceSwitch(user.workspaceId, !company.enabled, company.version);
      onChanged();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="market-switch">
      <div>
        <strong>{t('marketplace.switch.label')}</strong>
        <p className="market-hint">
          {company.enabled ? t('marketplace.switch.onText') : t('marketplace.switch.offText')}
        </p>
      </div>
      <Button variant={company.enabled ? 'light' : 'primary'} onClick={toggle} disabled={busy}>
        {busy
          ? t('marketplace.switch.saving')
          : company.enabled
            ? t('marketplace.switch.turnOff')
            : t('marketplace.switch.turnOn')}
      </Button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
