import React, { useRef } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { get } from '../../../lib/records.js';
import { useWideTable } from '../../records/grid/useWideTable.js';
import { ViewingChip } from './ViewingChip.jsx';
import { bandOf, viewingMoment, weekBands } from './weekModel.js';

const timeOf = (record) => viewingMoment(get(record, 'Appointment date & time')).time;

/** The chips of one day's viewings that `match`, in time order, or nothing. */
function Slot({ records, match }) {
  const chips = records.filter(match);
  if (!chips.length) return null;
  return (
    <ol>
      {chips.map((record) => (
        <li key={get(record, 'Viewing ID')}>
          <ViewingChip record={record} />
        </li>
      ))}
    </ol>
  );
}

/**
 * The mockup's week calendar as a table: days across (Monday to Sunday; the mockup shows
 * Monday to Friday, and weekend viewings stay), two-hour rows down, chips in their slots.
 * Viewings with a date but no time sit in their own first row. A grid wider than the page
 * scrolls sideways in a labelled region, as the mockup's calendar does.
 */
export function WeekGrid({ days, today }) {
  const { t, format } = useI18n();
  const scroll = useRef(null);
  const wide = useWideTable(scroll);
  const untimed = days.some(({ records }) => records.some((record) => !timeOf(record)));
  const row = (label, match) => (
    <tr key={label}>
      <th scope="row">{label}</th>
      {days.map(({ day, records }) => (
        <td key={day} className={day === today ? 'is-today' : undefined}>
          <Slot records={records} match={match} />
        </td>
      ))}
    </tr>
  );
  return (
    <div
      ref={scroll}
      className="viewing-grid-scroll grid-card"
      role="region"
      aria-label={t('viewings.calendar')}
      tabIndex={wide ? 0 : undefined}
    >
      <table className="viewing-grid">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">{t('viewings.time')}</span>
            </th>
            {days.map(({ day, records }) => (
              <th key={day} scope="col" className={day === today ? 'is-today' : undefined}>
                <time dateTime={day} aria-current={day === today ? 'date' : undefined}>
                  {format.date(day, { weekday: 'short', day: 'numeric' })}
                </time>
                <span className="sr-only">
                  , {t('viewings.dayCount', { count: records.length })}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {untimed && row(t('viewings.noTime'), (record) => !timeOf(record))}
          {weekBands(days).map((band) =>
            row(`${String(band).padStart(2, '0')}:00`, (record) => {
              const time = timeOf(record);
              return Boolean(time) && bandOf(time) === band;
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}
