/**
 * The CRM's business calendar is Asia/Dubai (UTC+4, no daylight saving), whatever time zone the
 * computer runs in. Connected screens use these helpers for "today", "this month", default ranges
 * and upcoming windows, and to show the wall-clock time of server timestamps.
 */
export const DUBAI_TIME_ZONE = 'Asia/Dubai';

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: DUBAI_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const clockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: DUBAI_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const DAY = 86_400_000;
const asDate = (value) => (value instanceof Date ? value : new Date(value));

/** The Dubai calendar day (`YYYY-MM-DD`) of an instant; defaults to now. */
export function dubaiToday(now = new Date()) {
  const parts = Object.fromEntries(
    dayFormat.formatToParts(asDate(now)).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** The Dubai calendar month (`YYYY-MM`) of an instant; defaults to now. */
export const dubaiMonth = (now = new Date()) => dubaiToday(now).slice(0, 7);

/** A `YYYY-MM-DD` day moved by whole days, using UTC arithmetic so nothing drifts. */
export const shiftDay = (day, days) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** The Dubai day `days` from today (negative for the past). */
export const dubaiDayFromToday = (days, now = new Date()) => shiftDay(dubaiToday(now), days);

/** "14:05": the 24-hour Dubai wall-clock time of a server timestamp. */
export const dubaiClock = (at) => clockFormat.format(asDate(at));

/** The leading `YYYY-MM-DD` of a stored date or wall-clock date-time, or '' when there is none. */
export const dayOf = (value) => /^(\d{4}-\d{2}-\d{2})/.exec(String(value || ''))?.[1] || '';
