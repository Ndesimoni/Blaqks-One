import { dubaiToday, shiftDay } from '../../../lib/dubaiDate.js';
import { get } from '../../../lib/records.js';

/** A viewing is a stored UAE calendar value, never a browser-zone or implied-midnight event. */
export function viewingMoment(value) {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ]([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?)?$/.exec(
    String(value ?? '').trim(),
  );
  if (!match) return { day: '', time: '' };
  const date = new Date(`${match[1]}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== match[1])
    return { day: '', time: '' };
  return { day: match[1], time: match[2] ? `${match[2]}:${match[3]}` : '' };
}

/** Monday containing a valid day; an omitted day means the current Dubai business day. */
export function weekStart(day = dubaiToday()) {
  const valid = viewingMoment(day).day;
  if (!valid) return '';
  const weekday = new Date(`${valid}T00:00:00Z`).getUTCDay();
  return shiftDay(valid, -((weekday + 6) % 7));
}

export function weekDays(start) {
  return viewingMoment(start).day
    ? Array.from({ length: 7 }, (_, index) => shiftDay(start, index))
    : [];
}

export function matchesViewingTab(record, tab, today) {
  if (tab === 'Completed') return get(record, 'Viewing status') === 'Completed';
  if (tab !== 'Upcoming') return true;
  const { day } = viewingMoment(get(record, 'Appointment date & time'));
  return Boolean(day) && day >= today;
}

/** Stable and non-mutating: date then known time; unspecified times follow timed viewings. */
export function orderViewings(records) {
  return records
    .map((record, index) => ({
      record,
      index,
      ...viewingMoment(get(record, 'Appointment date & time')),
    }))
    .sort((a, b) => {
      const left = `${a.day || '9999-99-99'} ${a.time || '24:00'}`;
      const right = `${b.day || '9999-99-99'} ${b.time || '24:00'}`;
      if (left !== right) return left < right ? -1 : 1;
      const aId = String(get(a.record, 'Viewing ID') ?? '');
      const bId = String(get(b.record, 'Viewing ID') ?? '');
      return (aId < bId ? -1 : aId > bId ? 1 : 0) || a.index - b.index;
    })
    .map(({ record }) => record);
}

/** Partition only authorized filtered records; invalid/missing dates never disappear. */
export function selectViewingWeek(records, start) {
  const days = weekDays(start).map((day) => ({ day, records: [] }));
  const byDay = new Map(days.map((item) => [item.day, item.records]));
  const unscheduled = [];
  for (const record of orderViewings(records)) {
    const { day } = viewingMoment(get(record, 'Appointment date & time'));
    if (!day) unscheduled.push(record);
    else byDay.get(day)?.push(record);
  }
  const count = days.reduce((total, day) => total + day.records.length, 0);
  return { days, unscheduled, count, outsideCount: records.length - count - unscheduled.length };
}

/** The two-hour row a viewing time falls in: 09:00 and 10:30 belong to 08:00 and 10:00. */
export const bandOf = (time) => {
  const hour = Number(String(time).slice(0, 2));
  return hour - (hour % 2);
};

/**
 * The mockup's two-hour rows for a week: 08:00 to 18:00 at least, widened to the week's
 * earliest and latest timed viewing so none falls outside the grid.
 */
export function weekBands(days) {
  const bands = days.flatMap(({ records }) =>
    records
      .map((record) => viewingMoment(get(record, 'Appointment date & time')).time)
      .filter(Boolean)
      .map(bandOf),
  );
  const first = Math.min(8, ...bands);
  const last = Math.max(18, ...bands);
  return Array.from({ length: (last - first) / 2 + 1 }, (_, index) => first + index * 2);
}
