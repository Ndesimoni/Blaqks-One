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
import { useDeadlineDone } from './useDeadlineDone.js';
import '../../records/grid/grid-card.css';
import './deadlines.css';

const PER_PAGE = 20;
/** The mockup's pill tones: Overdue warns, Today is gold (deadlines.css), Closed is done. */
const pillTone = { overdue: 'amber', today: 'gold', closed: 'green' };

/**
 * The mockup's deadline list: each group's pill and count above its own card of task rows, then
 * the grid footer. Counts cover every page; the rows are paged in deadline order.
 */
export function DeadlineList({ records, emptyDetail, filtered }) {
  const { t } = useI18n();
  const { data } = useRecords();
  const { query } = useWorkspaceView();
  const { dispatchRow, readOnly = false } = useWorkspaceActions();
  const done = useDeadlineDone();
  const today = dubaiToday();
  const ordered = orderDeadlines(records, today);
  const counts = new Map(
    groupDeadlines(ordered, today).map(({ key, records }) => [key, records.length]),
  );
  const { current, currentPage, setPage } = usePagedRecords(ordered, PER_PAGE);
  return (
    <div className="deadline-list">
      {current.length > 0 && (
        <section aria-label={t('followUps.records')}>
          {groupDeadlines(current, today).map(({ key, records }) => (
            <div key={key} className={`deadline-group is-${key}`}>
              <h2 className="deadline-group-title">
                <span className={`deadline-pill badge badge-${pillTone[key] || 'slate'}`}>
                  {t(`followUps.${key}`)}
                </span>
                <span className="deadline-count">{counts.get(key)}</span>
              </h2>
              <ol className="deadline-rows grid-card">
                {records.map((record) => (
                  <DeadlineRow
                    key={get(record, 'Activity ID')}
                    record={record}
                    data={data}
                    today={today}
                    done={done}
                    onOpen={() => dispatchRow('Follow-ups', record)}
                  />
                ))}
              </ol>
            </div>
          ))}
        </section>
      )}
      {!records.length && (
        <div className="grid-card">
          <RecordTableEmpty
            module="Follow-ups"
            title={t('followUps.empty')}
            detail={emptyDetail}
            query={query}
            readOnly={readOnly}
            action={filtered ? false : undefined}
          />
        </div>
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
