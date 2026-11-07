import React, { useState } from 'react';
import { Empty } from '../../../components/ui/Empty.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { GridFilterBar } from '../../records/grid/GridFilterBar.jsx';
import '../../records/grid/grid-filter.css';
import { MarketplaceApplicationRow } from './MarketplaceApplicationRow.jsx';

/**
 * The platform queue as the approved mockup's Waiting and Decided (design queue item 31), with
 * search by company or applicant; pending applications first.
 */
export function MarketplaceApplicationList({ rows, onChanged }) {
  const { t } = useI18n();
  const [view, setView] = useState({ decided: false, query: '' });
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
  const needle = view.query.trim().toLowerCase();
  const shown = rows.filter(
    (row) =>
      (row.state !== 'pending') === view.decided &&
      (!needle || `${row.company || ''} ${row.appliedBy || ''}`.toLowerCase().includes(needle)),
  );
  const tabs = [t('marketplace.applications.waiting'), t('marketplace.applications.decided')];
  return (
    <>
      <GridFilterBar
        module={t('marketplace.applications.module')}
        presetLabel={tabs[Number(view.decided)]}
        tabs={tabs}
        tab={tabs[Number(view.decided)]}
        onTab={(name) => setView({ ...view, decided: name === tabs[1] })}
        query={view.query}
        onQuery={(query) => setView({ ...view, query })}
      />
      {!shown.length && <p className="market-hint">{t('marketplace.applications.noneHere')}</p>}
      <ul className="market-applications" aria-label={t('marketplace.applications.listLabel')}>
        {shown.map((row) => (
          <MarketplaceApplicationRow key={row.id} row={row} onChanged={onChanged} />
        ))}
      </ul>
    </>
  );
}
