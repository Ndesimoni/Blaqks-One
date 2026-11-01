import React, { useState } from 'react';
import { useWorkspaceActions, useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { dubaiToday } from '../../../lib/dubaiDate.js';
import { get } from '../../../lib/records.js';
import { RecordTableEmpty } from '../../records/RecordTableEmpty.jsx';
import { UnscheduledViewings } from './UnscheduledViewings.jsx';
import { ViewingCard } from './ViewingCard.jsx';
import { WeekToolbar } from './WeekToolbar.jsx';
import { selectViewingWeek, weekStart } from './weekModel.js';
import '../../records/grid/grid-card.css';
import './week.css';

export function ViewingsWeek({ records, filtered }) {
  const { t, format } = useI18n();
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
          <section className="viewing-week-days" aria-label={t('viewings.calendar')}>
            {days.map(({ day, records }) => (
              <section
                key={day}
                className={`viewing-week-day${day === today ? ' is-today' : ''}`}
                aria-label={format.date(day, { dateStyle: 'full' })}
              >
                <h3>
                  <time dateTime={day} aria-current={day === today ? 'date' : undefined}>
                    {format.date(day, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </time>
                  {day === today && (
                    <span className="viewing-today-label">{t('viewings.today')}</span>
                  )}
                </h3>
                <p className="viewing-day-count">
                  {t('viewings.dayCount', { count: records.length })}
                </p>
                {records.length ? (
                  <ol>
                    {records.map((record) => (
                      <ViewingCard key={get(record, 'Viewing ID')} record={record} />
                    ))}
                  </ol>
                ) : (
                  <p className="viewing-no-events">{t('viewings.noViewings')}</p>
                )}
              </section>
            ))}
          </section>
          <UnscheduledViewings records={unscheduled} />
        </>
      )}
    </div>
  );
}
