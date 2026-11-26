import { get, isDone } from '../../../lib/records.js';

/**
 * The approved mockup's groups (Overdue, Today, This week) lead; Later, No due date and Closed
 * follow so no follow-up drops out of view (owner, 2026-11-01).
 */
export const deadlineGroups = ['overdue', 'today', 'week', 'later', 'undated', 'closed'];

/** A calendar day `days` after `day` (`YYYY-MM-DD`, no time zone involved). */
export function addDays(day, days) {
  const stamp = new Date(`${day}T00:00:00Z`);
  stamp.setUTCDate(stamp.getUTCDate() + days);
  return stamp.toISOString().slice(0, 10);
}

/** The Sunday ending the Monday–Sunday week `today` falls in, as on the Viewings week. */
export const weekEnd = (today) =>
  addDays(today, (7 - new Date(`${today}T00:00:00Z`).getUTCDay()) % 7);

/** Stored dates are UAE calendar values, not browser-zone instants. Invalid dates stay visible. */
export function deadlineMoment(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?)?$/.exec(
    String(value ?? '').trim(),
  );
  if (!match) return { day: '', time: '' };
  const [, year, month, day, hour, minute] = match;
  const stamp = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (
    Number.isNaN(stamp.valueOf()) ||
    stamp.toISOString().slice(0, 10) !== `${year}-${month}-${day}`
  )
    return { day: '', time: '' };
  return { day: `${year}-${month}-${day}`, time: hour ? `${hour}:${minute}` : '' };
}

export function deadlineGroup(record, today) {
  if (isDone(get(record, 'Task status'))) return 'closed';
  const { day } = deadlineMoment(get(record, 'Due date'));
  if (!day) return 'undated';
  if (day < today) return 'overdue';
  if (day === today) return 'today';
  return day <= weekEnd(today) ? 'week' : 'later';
}

/** What a row shows on the right (the mockup's time): a time today, Yesterday, a weekday or a date. */
export function deadlineWhen(record, today) {
  const { day, time } = deadlineMoment(get(record, 'Due date'));
  if (!day) return { kind: 'none' };
  if (day === today) return time ? { kind: 'time', time } : { kind: 'today' };
  if (day === addDays(today, -1)) return { kind: 'yesterday', time };
  if (day > today && day <= weekEnd(today)) return { kind: 'weekday', day, time };
  return { kind: 'date', day, time };
}

/** The connected Overdue preset means before today, matching the deadline heading. */
export const isOverdueDeadline = (record, today) => deadlineGroup(record, today) === 'overdue';

/** Never sort the workspace array in place. IDs break date ties independently of grid order. */
export function orderDeadlines(records, today) {
  return records
    .map((record, index) => {
      const group = deadlineGroup(record, today);
      const { day, time } = deadlineMoment(get(record, 'Due date'));
      return { record, index, group, when: day ? `${day} ${time}` : '' };
    })
    .sort((a, b) => {
      const group = deadlineGroups.indexOf(a.group) - deadlineGroups.indexOf(b.group);
      if (group) return group;
      if (Boolean(a.when) !== Boolean(b.when)) return a.when ? -1 : 1;
      if (a.when !== b.when) {
        const direction = a.group === 'closed' ? -1 : 1;
        return (a.when < b.when ? -1 : 1) * direction;
      }
      const left = String(get(a.record, 'Activity ID') ?? '');
      const right = String(get(b.record, 'Activity ID') ?? '');
      return (left < right ? -1 : left > right ? 1 : 0) || a.index - b.index;
    })
    .map(({ record }) => record);
}

export function groupDeadlines(records, today) {
  return deadlineGroups
    .map((key) => ({
      key,
      records: records.filter((record) => deadlineGroup(record, today) === key),
    }))
    .filter(({ records }) => records.length > 0);
}
