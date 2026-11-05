import React, { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useCalendar } from '../../hooks/useWorkspace.js';
import { calendarRequest } from '../../services/calendar/client.js';

export function CalendarConnection() {
  const { status, available, error, refresh, mutate } = useCalendar();
  const [calendars, setCalendars] = useState([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [calendarRetry, setCalendarRetry] = useState(0);
  useEffect(() => {
    if (!status.connected || status.calendar) return;
    const controller = new AbortController();
    calendarRequest('calendars', { signal: controller.signal })
      .then((result) => {
        setCalendars(result.calendars);
        setSelected(result.calendars[0]?.id || '');
        setMessage('');
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError') setMessage(failure.message);
      });
    return () => controller.abort();
  }, [status.connected, status.calendar?.id, calendarRetry]);
  const act = async (action) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (failure) {
      setMessage(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const connect = () =>
    act(async () => {
      const result = await mutate('connect');
      const url = new URL(result.url);
      if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth')
        throw Error('The Google connection link is invalid.');
      window.location.assign(url.href);
    });
  const disconnect = () => {
    if (
      !confirm(
        'Disconnect Google Calendar? Existing Google events will stay in your calendar. CRM updates will stop until you reconnect.',
      )
    )
      return;
    act(() => mutate('disconnect'));
  };
  const caption =
    available === null
      ? 'Checking your connection…'
      : !available
        ? 'Your CRM schedule is available. The Google Calendar connection is currently offline.'
        : !status.configured
          ? 'Google Calendar is awaiting workspace setup. You can schedule activities here now.'
          : status.connected
            ? status.calendar
              ? `Connected to ${status.calendar.summary}. Changes sync automatically.`
              : 'Google is connected. Choose where your CRM activities should appear.'
            : 'Connect Google to see CRM appointments and reminders in your calendar.';
  return (
    <section className="panel calendar-connection" aria-labelledby="calendar-connection-heading">
      <div className="calendar-connection-copy">
        <span className="calendar-mark">
          <Icon name="calendar" size={24} />
        </span>
        <div>
          <h2 id="calendar-connection-heading">Google Calendar</h2>
          <p role="status">{caption}</p>
        </div>
      </div>
      <div className="calendar-connection-actions">
        <Button
          variant="light"
          disabled={busy}
          onClick={() =>
            act(async () => {
              await refresh();
              setCalendarRetry((value) => value + 1);
            })
          }
        >
          Refresh connection
        </Button>
        {status.connected ? (
          <Button variant="light" disabled={busy} onClick={disconnect}>
            Disconnect Google
          </Button>
        ) : (
          <Button disabled={busy || !available || !status.configured} onClick={connect}>
            Connect Google Calendar
          </Button>
        )}
      </div>
      {status.connected && !status.calendar && (
        <div className="calendar-selection">
          <label htmlFor="google-calendar-choice">Choose a calendar</label>
          <select
            id="google-calendar-choice"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            {calendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.summary}
              </option>
            ))}
          </select>
          <Button
            disabled={busy || !selected}
            onClick={() => act(() => mutate('selection', { id: selected }, 'PUT'))}
          >
            Use this calendar
          </Button>
          {!calendars.length && (
            <p>No writable calendars loaded yet. Refresh your connection to try again.</p>
          )}
        </div>
      )}
      {(message || error || status.connectionError) && (
        <p className="field-error" role="alert">
          {message || error || status.connectionError}
        </p>
      )}
      <p className="calendar-footnote">
        Dubai time · Client invitations are optional · Changes made in Google stay in Google
      </p>
    </section>
  );
}
