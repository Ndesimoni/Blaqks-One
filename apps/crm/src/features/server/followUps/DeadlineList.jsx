import React from 'react';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { dubaiToday } from '../../../lib/dubaiDate.js';
import { get } from '../../../lib/records.js';
import { GridFoot } from '../../records/grid/GridFoot.jsx';
import { usePagedRecords } from '../../records/grid/usePagedRecords.js';
import { RecordTableEmpty } from '../../records/RecordTableEmpty.jsx';
import { DeadlineRow } from './DeadlineRow.jsx';
import { groupDeadlines, orderDeadlines } from './deadlineModel.js';
import '../../records/grid/grid-card.css';
import './deadlines.css';

const PER_PAGE = 12;

export function DeadlineList({ records, emptyDetail, filtered }) {
  const { t } = useI18n();
  const { data } = useRecords();
  const { query } = useWorkspaceView();
  const { dispatchRow, readOnly = false } = useWorkspaceActions();
  const today = dubaiToday();
  const ordered = orderDeadlines(records, today);
  const counts = new Map(
    groupDeadlines(ordered, today).map(({ key, records }) => [key, records.length]),
  );
  const { current, currentPage, setPage } = usePagedRecords(ordered, PER_PAGE);
  return (
    <div className="grid-card deadline-list">
      {current.length > 0 && (
        <section aria-label={t('followUps.records')}>
          {groupDeadlines(current, today).map(({ key, records }) => (
            <div key={key} className={`deadline-group is-${key}`}>
              <h2 className="deadline-group-title">
                {t(`followUps.${key}`)}
                <span>{t('followUps.groupCount', { count: counts.get(key) })}</span>
              </h2>
              <ol className="deadline-rows">
                {records.map((record) => (
                  <DeadlineRow
                    key={get(record, 'Activity ID')}
                    record={record}
                    data={data}
                    readOnly={readOnly}
                    onOpen={() => dispatchRow('Follow-ups', record)}
                  />
                ))}
              </ol>
            </div>
          ))}
        </section>
      )}
      {!records.length && (
        <RecordTableEmpty
          module="Follow-ups"
          title={t('followUps.empty')}
          detail={emptyDetail}
          query={query}
          readOnly={readOnly}
          action={filtered ? false : undefined}
        />
      )}
      <GridFoot
        total={records.length}
        page={currentPage}
        perPage={PER_PAGE}
        label={t('followUps.pages')}
        onPage={setPage}
      />
    </div>
  );
}
