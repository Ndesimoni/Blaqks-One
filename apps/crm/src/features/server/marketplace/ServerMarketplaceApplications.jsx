import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import './marketplace-applications.css';
import './marketplace.css';
import './marketplace-profile.css';
import { MarketplaceApplicationList } from './MarketplaceApplicationList.jsx';
import { useMarketplaceApplications } from './useMarketplace.js';

/**
 * "Marketplace applications" (broker marketplace MK1a), the Super Admin's settings screen:
 * companies that applied, pending first, with the counts they applied with. The reviewer never
 * sees a company's records.
 */
export function ServerMarketplaceApplications() {
  const { t } = useI18n();
  const list = useMarketplaceApplications();
  return (
    <div className="marketplace-page">
      {list.loading && !list.value && <p role="status">{t('marketplace.loading')}</p>}
      {list.error && !list.value && (
        <section className="panel recovery-panel">
          <p className="field-error" role="alert">
            {list.error}
          </p>
          <Button onClick={list.reload}>{t('marketplace.retry')}</Button>
        </section>
      )}
      {list.value && <MarketplaceApplicationList rows={list.value} onChanged={list.reload} />}
    </div>
  );
}
