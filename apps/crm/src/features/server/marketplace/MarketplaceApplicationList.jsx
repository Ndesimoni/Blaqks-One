import React from 'react';
import { Empty } from '../../../components/ui/Empty.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceApplicationRow } from './MarketplaceApplicationRow.jsx';

/** The platform queue, pending applications first. */
export function MarketplaceApplicationList({ rows, onChanged }) {
  const { t } = useI18n();
  if (!rows.length)
    return (
      <section className="panel">
        <Empty
          icon="building"
          title={t('marketplace.applications.empty.title')}
          detail={t('marketplace.applications.empty.text')}
        />
      </section>
    );
  return (
    <ul className="market-applications" aria-label={t('marketplace.applications.listLabel')}>
      {rows.map((row) => (
        <MarketplaceApplicationRow key={row.id} row={row} onChanged={onChanged} />
      ))}
    </ul>
  );
}
