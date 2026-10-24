import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import './marketplace-join.css';
import './marketplace-profile.css';
import './marketplace-requests.css';
import './marketplace.css';
import { MarketplaceApproved } from './MarketplaceApproved.jsx';
import { MarketplaceNotApplied } from './MarketplaceNotApplied.jsx';
import { MarketplaceWaiting } from './MarketplaceWaiting.jsx';
import { useMarketplaceStatus } from './useMarketplace.js';

/**
 * The Marketplace screen for company members (broker marketplace MK1): where the company
 * stands, the checklist it must meet, the Admin's application and, once approved, the company
 * switch, joining and the member's own profile. Client requests arrive with MK2.
 */
export function ServerMarketplace() {
  const { user } = useSession();
  const { t } = useI18n();
  const status = useMarketplaceStatus();
  const company = status.value?.company;
  const admin = user?.roleId === 'admin';
  return (
    <div className="marketplace-page">
      {status.loading && !company && <p role="status">{t('marketplace.loading')}</p>}
      {status.error && !company && (
        <section className="panel recovery-panel">
          <p className="field-error" role="alert">
            {status.error}
          </p>
          <Button onClick={status.reload}>{t('marketplace.retry')}</Button>
        </section>
      )}
      {company?.state === 'not_applied' && (
        <MarketplaceNotApplied
          checklist={company.checklist}
          admin={admin}
          onChanged={status.reload}
        />
      )}
      {['pending', 'declined', 'revoked'].includes(company?.state) && (
        <MarketplaceWaiting company={company} admin={admin} onChanged={status.reload} />
      )}
      {company?.state === 'approved' && (
        <MarketplaceApproved
          company={company}
          member={status.value?.member}
          admin={admin}
          onChanged={status.reload}
        />
      )}
    </div>
  );
}
