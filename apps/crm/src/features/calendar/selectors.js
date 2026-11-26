import { ACTIVITY_TYPES, CALENDAR_TIME_ZONE } from '../../config/calendar.js';
import { schema } from '../../lib/schema.js';

const validDay = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** Dubai has a fixed UTC+04:00 offset. Never interpret CRM wall-clock times in the host zone. */
export function dubaiInstant(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value || '')) return null;
  if (
    !validDay(value.slice(0, 10)) ||
    Number(value.slice(11, 13)) > 23 ||
    Number(value.slice(14, 16)) > 59
  )
    return null;
  if (value.length > 16 && Number(value.slice(17, 19)) > 59) return null;
  const date = new Date(`${value}+04:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function scheduleErrors(module, record, data, { includeIntegration = true } = {}) {
  if (!['Follow-ups', 'Viewings'].includes(module)) return {};
  const errors = {};
  const startKey = module === 'Viewings' ? 'appointment_date_time' : 'calendar_start';
  const start = record[startKey];
  const enabled = record.calendar_enabled === 'Yes';
  if (start && !dubaiInstant(start)) errors[startKey] = 'Enter a valid Dubai date and time.';
  if (
    enabled &&
    !start &&
    (module === 'Viewings' || ['Call', 'Meeting', 'Viewing'].includes(record.calendar_activity))
  )
    errors[startKey] = 'Choose a start date and time for this appointment.';
  if (enabled && !start && module === 'Follow-ups' && !validDay(record.due_date))
    errors.due_date = 'Choose a due date or a start date and time.';
  for (const [key, min, max] of [
    ['calendar_duration', 1, 1440],
    ...(includeIntegration ? [['calendar_reminder', 0, 40320]] : []),
  ]) {
    if (
      record[key] !== undefined &&
      record[key] !== '' &&
      (!Number.isInteger(Number(record[key])) ||
        Number(record[key]) < min ||
        Number(record[key]) > max)
    )
      errors[key] = `Enter a whole number between ${min} and ${max}.`;
  }
  if (record.calendar_activity && !ACTIVITY_TYPES.includes(record.calendar_activity))
    errors.calendar_activity = 'Choose an activity type.';
  if (includeIntegration && record.calendar_invite === 'Yes') {
    const client = data?.Clients?.find((row) => row.client_id === record.client_id);
    if (!client || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email || ''))
      errors.calendar_invite = 'Choose a client with a valid email address to send an invitation.';
    if (!enabled) errors.calendar_invite = 'Enable Google Calendar sync to send an invitation.';
  }
  return errors;
}

export function selectCalendarEntries(data) {
  return ['Follow-ups', 'Viewings']
    .flatMap((module) =>
      (data[module] || []).flatMap((record) => {
        const id = record[schema(module)[0].key];
        const client = data.Clients?.find((row) => row.client_id === record.client_id);
        const property = data.Properties?.find((row) => row.property_id === record.property_id);
        const activity =
          record.calendar_activity || (module === 'Viewings' ? 'Viewing' : 'Follow-up');
        const value = module === 'Viewings' ? record.appointment_date_time : record.calendar_start;
        const rawStart = typeof value === 'string' ? value : '';
        const instant = dubaiInstant(rawStart);
        const day = rawStart?.slice(0, 10) || record.due_date;
        if (!validDay(day)) return [];
        const closed = /^(completed|cancelled|canceled|closed)$/i.test(
          module === 'Viewings' ? record.viewing_status || '' : record.task_status || '',
        );
        const errors = scheduleErrors(module, record, data);
        const requestedDuration = Number(
          record.calendar_duration || (module === 'Viewings' ? 60 : 30),
        );
        const duration =
          Number.isInteger(requestedDuration) && requestedDuration > 0 && requestedDuration <= 1440
            ? requestedDuration
            : 30;
        const key = `${module}:${id}`;
        const title =
          record.next_action || `${activity}${client?.full_name ? ` · ${client.full_name}` : ''}`;
        const summary = `${activity} · ${record.next_action || client?.full_name || property?.listing_title || id}`;
        let start, end;
        if (instant) {
          start = { dateTime: instant, timeZone: CALENDAR_TIME_ZONE };
          end = {
            dateTime: new Date(new Date(instant).getTime() + duration * 60000).toISOString(),
            timeZone: CALENDAR_TIME_ZONE,
          };
        } else {
          start = { date: day };
          end = {
            date: new Date(new Date(`${day}T00:00:00Z`).getTime() + 86400000)
              .toISOString()
              .slice(0, 10),
          };
        }
        return [
          {
            key,
            module,
            record,
            id,
            title,
            activity,
            day,
            closed,
            time: instant
              ? new Intl.DateTimeFormat('en-AE', {
                  timeZone: CALENDAR_TIME_ZONE,
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(instant))
              : 'All day',
            clientName: client?.full_name || '',
            propertyName: property?.listing_title || '',
            enabled: record.calendar_enabled === 'Yes',
            errors,
            event: {
              key,
              summary: summary.slice(0, 500),
              description: [
                `Keys with Simoni CRM`,
                `Record: ${key}`,
                client?.full_name && `Client: ${client.full_name}`,
                property?.listing_title && `Property: ${property.listing_title}`,
              ]
                .filter(Boolean)
                .join('\n')
                .slice(0, 2000),
              location: String(record.calendar_location || '').slice(0, 1000),
              start,
              end,
              reminderMinutes: Number(record.calendar_reminder ?? 15),
              attendees:
                record.calendar_invite === 'Yes' && client?.email ? [{ email: client.email }] : [],
            },
          },
        ];
      }),
    )
    .sort((a, b) =>
      `${a.day}${a.event.start.dateTime || ''}`.localeCompare(
        `${b.day}${b.event.start.dateTime || ''}`,
      ),
    );
}

export function calendarSnapshot(data, demo) {
  return selectCalendarEntries(data)
    .filter(
      (entry) =>
        entry.enabled &&
        !entry.closed &&
        !Object.keys(entry.errors).length &&
        (!demo || entry.record.calendar_enabled === 'Yes'),
    )
    .map((entry) => entry.event);
}
