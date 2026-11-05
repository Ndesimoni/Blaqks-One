import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { get } from '../../../lib/records.js';
import { GridFoot } from '../../records/grid/GridFoot.jsx';
import { usePagedRecords } from '../../records/grid/usePagedRecords.js';
import { ViewingCard } from './ViewingCard.jsx';
import './unscheduled.css';

const PER_PAGE = 12;

export function UnscheduledViewings({ records }) {
  const { t } = useI18n();
  const { current, currentPage, setPage } = usePagedRecords(records, PER_PAGE);
  if (!records.length) return null;
  return (
    <section className="grid-card viewing-unscheduled" aria-label={t('viewings.unscheduled')}>
      <header>
        <h2>{t('viewings.unscheduled')}</h2>
        <p>{t('viewings.unscheduledHint')}</p>
        <p>{t('viewings.unscheduledCount', { count: records.length })}</p>
      </header>
      <ol className="viewing-unscheduled-cards">
        {current.map((record) => (
          <ViewingCard key={get(record, 'Viewing ID')} record={record} />
        ))}
      </ol>
      <GridFoot
        total={records.length}
        page={currentPage}
        perPage={PER_PAGE}
        label={t('viewings.unscheduledPages')}
        onPage={setPage}
      />
    </section>
  );
}
