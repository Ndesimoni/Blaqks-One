import React, { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import {
  useCalendar,
  useRecords,
  useWorkspaceActions,
  useWorkspaceView,
} from '../../hooks/useWorkspace.js';
import { CALENDAR_TIME_ZONE } from '../../config/calendar.js';
import { CalendarConnection } from './CalendarConnection.jsx';
import { CalendarStatus } from './CalendarStatus.jsx';
import { selectCalendarEntries } from './selectors.js';

const dubaiDay = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: CALENDAR_TIME_ZONE }).format(new Date());
const monthLabel = (month) =>
  new Intl.DateTimeFormat('en-AE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
const shiftMonth = (month, amount) => {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
};
function monthDays(month) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const start = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * 86400000);
  return Array.from({ length: 42 }, (_, index) =>
    new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10),
  );
}

export function CalendarPage() {
  const { data, db } = useRecords();
  const { status, mutate } = useCalendar();
  const { add, edit, dispatchRow } = useWorkspaceActions();
  const { query, setQuery } = useWorkspaceView();
  const [month, setMonth] = useState(() => dubaiDay().slice(0, 7));
  const [day, setDay] = useState('');
  const [type, setType] = useState('All');
  const [showClosed, setShowClosed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const entries = useMemo(() => selectCalendarEntries(data), [data]);
  const filtered = entries.filter(
    (entry) =>
      (!entry.closed || showClosed) &&
      (type === 'All' || entry.activity === type) &&
      `${entry.title} ${entry.clientName} ${entry.propertyName} ${entry.id}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const visible = filtered.filter((entry) =>
    day ? entry.day === day : entry.day.startsWith(month),
  );
  const days = monthDays(month);
  const today = dubaiDay();
  const schedule = (activity) =>
    add(activity === 'Viewing' ? 'Viewings' : 'Follow-ups', {
      calendar_enabled: 'Yes',
      calendar_activity: activity,
      ...(activity === 'Viewing'
        ? { viewing_status: 'Scheduled', appointment_date_time: `${day || today}T10:00` }
        : {
            task_status: 'Open',
            due_date: day || today,
            ...(['Call', 'Meeting'].includes(activity)
              ? { calendar_start: `${day || today}T10:00` }
              : {}),
          }),
    });
  const retryFailed = async () => {
    setRetrying(true);
    try {
      await mutate('retry');
    } catch {
      /* The connection card presents the error. */
    } finally {
      setRetrying(false);
    }
  };
  const failed = Object.values(status.items || {}).some((item) => item.state === 'failed');
  return (
    <div className="page-stack calendar-page">
      <CalendarConnection />
      <div className="directory-top calendar-toolbar">
        <div>
          <strong>Your appointments, in one place</strong>
          <p>Follow-ups, property viewings, meetings and calls.</p>
        </div>
        <div className="calendar-create-actions">
          {['Follow-up', 'Viewing', 'Meeting', 'Call'].map((activity) => (
            <Button
              key={activity}
              variant={activity === 'Meeting' ? 'primary' : 'light'}
              icon="plus"
              onClick={() => schedule(activity)}
            >
              Schedule {activity.toLowerCase()}
            </Button>
          ))}
        </div>
      </div>
      {db.demo && (
        <p className="calendar-footnote">
          Sample activities stay local. Enable Google sync on an activity to include it in your
          connected calendar.
        </p>
      )}
      <section className="panel calendar-month" aria-labelledby="calendar-month-heading">
        <div className="calendar-month-toolbar">
          <h2 id="calendar-month-heading">{monthLabel(month)}</h2>
          <div className="calendar-month-controls">
            <Button
              variant="light"
              aria-label="Previous month"
              onClick={() => {
                setMonth(shiftMonth(month, -1));
                setDay('');
              }}
            >
              <Icon name="chevron" className="calendar-previous" size={16} />
            </Button>
            <Button
              variant="light"
              onClick={() => {
                setMonth(today.slice(0, 7));
                setDay(today);
              }}
            >
              Today
            </Button>
            <Button
              variant="light"
              aria-label="Next month"
              onClick={() => {
                setMonth(shiftMonth(month, 1));
                setDay('');
              }}
            >
              <Icon name="chevron" size={16} />
            </Button>
          </div>
        </div>
        <div className="calendar-grid" role="group" aria-label="Choose a date">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
            <span className="calendar-weekday" key={label}>
              {label}
            </span>
          ))}
          {days.map((date) => {
            const events = filtered.filter((entry) => entry.day === date);
            return (
              <button
                key={date}
                className={`calendar-day${date.startsWith(month) ? '' : ' outside-month'}${date === today ? ' is-today' : ''}`}
                aria-label={`${date}, ${events.length} activities`}
                aria-pressed={day === date}
                onClick={() => {
                  setDay(date);
                  setMonth(date.slice(0, 7));
                }}
              >
                <span className="calendar-day-number">{Number(date.slice(-2))}</span>
                {events.slice(0, 2).map((entry) => (
                  <span className="calendar-day-event" key={entry.key}>
                    {entry.time === 'All day' ? entry.activity : `${entry.time} ${entry.activity}`}
                  </span>
                ))}
                {events.length > 2 && (
                  <span className="calendar-more-events">+{events.length - 2} more</span>
                )}
                {events.length > 0 && <span className="calendar-day-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </section>
      <section className="panel calendar-agenda" aria-labelledby="calendar-agenda-heading">
        <div className="calendar-agenda-toolbar">
          <div>
            <h2 id="calendar-agenda-heading">
              {day ? `Activities for ${day}` : `${monthLabel(month)} activities`}
            </h2>
            <p>
              {visible.length} scheduled {visible.length === 1 ? 'activity' : 'activities'} · Dubai
              time
            </p>
          </div>
          {day && (
            <Button variant="light" onClick={() => setDay('')}>
              Show full month
            </Button>
          )}
          {failed && (
            <Button variant="light" disabled={retrying} onClick={retryFailed}>
              Retry failed sync
            </Button>
          )}
        </div>
        <div className="calendar-filters">
          <label className="calendar-search">
            <span>Search activities</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Client, property or activity…"
            />
          </label>
          <label>
            <span>Activity type</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              {['All', 'Follow-up', 'Viewing', 'Meeting', 'Call'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="calendar-checkbox">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(event) => setShowClosed(event.target.checked)}
            />{' '}
            Include completed / cancelled
          </label>
        </div>
        <div className="calendar-activity-list">
          {visible.map((entry) => {
            const item = status.items?.[entry.key];
            return (
              <article
                className="calendar-activity"
                key={entry.key}
                aria-label={`${entry.activity}: ${entry.title}`}
              >
                <div className="calendar-activity-date">
                  <strong>{entry.day.slice(-2)}</strong>
                  <span>{entry.time}</span>
                </div>
                <div className="calendar-activity-copy">
                  <div className="calendar-row-heading">
                    <h3>{entry.title}</h3>
                    <CalendarStatus entry={entry} status={status} />
                  </div>
                  <p>
                    {[entry.activity, entry.clientName, entry.propertyName]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {entry.record.calendar_location && <p>{entry.record.calendar_location}</p>}
                  {item?.error && <p className="field-error">{item.error}</p>}
                </div>
                <div className="calendar-activity-actions">
                  {item?.state === 'synced' && item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      Open in Google Calendar
                    </a>
                  )}
                  <Button
                    variant="light"
                    aria-label={`Edit ${entry.id}`}
                    onClick={() => edit(entry.module, entry.record, 'schedule')}
                  >
                    Edit activity
                  </Button>
                  <Button
                    variant="light"
                    aria-label={`View ${entry.id}`}
                    onClick={() => dispatchRow(entry.module, entry.record)}
                  >
                    View activity
                  </Button>
                </div>
              </article>
            );
          })}
          {!visible.length && (
            <div className="empty">
              <Icon name="calendar" size={30} />
              <h3>No activities scheduled</h3>
              <p>Choose a day and schedule a follow-up, viewing, meeting or call.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
