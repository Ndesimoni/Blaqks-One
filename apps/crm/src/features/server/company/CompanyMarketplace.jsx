import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useMarketplaceStatus } from '../marketplace/useMarketplace.js';
import { InlineConfirm } from '../profile/InlineConfirm.jsx';
import { ProfileCard } from '../profile/ProfileCard.jsx';

/**
 * The mockup's Marketplace card: once Blaqks One approved the company, the Admin's switch for
 * every member (turning it off asks first); before that, where the application stands and the
 * way to the Marketplace page. The server repeats the version, so a stale switch is refused.
 */
export function CompanyMarketplace() {
  const { t } = useI18n();
  const { api, user } = useSession();
  const { navigate } = useNavigation();
  const status = useMarketplaceStatus();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const market = status.value?.company;
  const turn = async (enabled) => {
    setBusy(true);
    setError('');
    try {
      await api.setMarketplaceSwitch(user.workspaceId, enabled, market.version);
      await status.reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setAsking(false);
      setBusy(false);
    }
  };
  const on = Boolean(market?.enabled);
  return (
    <ProfileCard id="company-marketplace" title={t('company.marketplace')}>
      <div className="acct-card-body">
        {!market && status.error && <p className="field-error">{status.error}</p>}
        {!market && !status.error && <p className="acct-muted">{t('company.loading')}</p>}
        {market?.state === 'approved' && (
          <div className="profile-switch-row">
            <span>
              <strong id="company-market-title">
                {t(on ? 'company.marketOn' : 'company.marketOff')}
              </strong>
              <span className="acct-muted">
                {t(on ? 'company.marketOnText' : 'company.marketOffText')}
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="profile-switch"
              aria-labelledby="company-market-title"
              checked={on}
              disabled={busy || asking}
              onChange={() => (on ? setAsking(true) : turn(true))}
            />
          </div>
        )}
        {asking && (
          <InlineConfirm
            label={t('company.marketOffAsk')}
            prompt={t('company.marketOffAsk')}
            confirmLabel={t('company.marketOffConfirm')}
            busy={busy}
            onConfirm={() => turn(false)}
            onCancel={() => setAsking(false)}
          />
        )}
        {market && market.state !== 'approved' && (
          <>
            <strong>{t(`company.market.${market.state}`)}</strong>
            <p className="acct-muted">{t('company.marketGate')}</p>
            <span>
              <Button variant="light" onClick={() => navigate('Marketplace')}>
                {t('company.openMarketplace')}
              </Button>
            </span>
          </>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </ProfileCard>
  );
}
