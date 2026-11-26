import React, { useState } from 'react';
import { useWorkspaceActions, useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { dubaiToday } from '../../../lib/dubaiDate.js';
import { RecordTableEmpty } from '../../records/RecordTableEmpty.jsx';
import { UnscheduledViewings } from './UnscheduledViewings.jsx';
import { WeekGrid } from './WeekGrid.jsx';
import { WeekToolbar } from './WeekToolbar.jsx';
import { selectViewingWeek, weekStart } from './weekModel.js';
import '../../records/grid/grid-card.css';
import './week.css';

/**
 * Connected Viewings as the mockup's week calendar: the toolbar, the time grid, then the
 * viewings with no valid date (kept from before, so none disappears).
 */
export function ViewingsWeek({ records, filtered }) {
  const { t } = useI18n();
  const { query, setPage } = useWorkspaceView();
  const { readOnly = false } = useWorkspaceActions();
  const today = dubaiToday();
  const [start, setStart] = useState(() => weekStart(today));
  const { days, unscheduled, count, outsideCount } = selectViewingWeek(records, start);
  return (
    <div className="viewing-week">
      <WeekToolbar
        start={start}
        today={today}
        count={count}
        onChange={(day) => {
          setStart(weekStart(day));
          setPage(0);
        }}
      />
      {!records.length ? (
        <div className="grid-card">
          <RecordTableEmpty
            module="Viewings"
            title={t('viewings.empty')}
            detail={t(filtered ? 'viewings.filtered' : 'viewings.first')}
            query={query}
            readOnly={readOnly}
            action={filtered ? false : undefined}
          />
        </div>
      ) : (
        <>
          {!count && (
            <p className="viewing-week-empty" role="status">
              {t('viewings.noWeekViewings')}
            </p>
          )}
          {outsideCount > 0 && (
            <p className="viewing-week-empty">
              {t('viewings.outsideWeek', { count: outsideCount })}
            </p>
          )}
          <WeekGrid days={days} today={today} />
          <UnscheduledViewings records={unscheduled} />
        </>
      )}
    </div>
  );
}
