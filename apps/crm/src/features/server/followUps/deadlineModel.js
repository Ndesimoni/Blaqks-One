import { get, isDone } from '../../../lib/records.js';

export const deadlineGroups = ['overdue', 'today', 'upcoming', 'undated', 'closed'];

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
  return day < today ? 'overdue' : day === today ? 'today' : 'upcoming';
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
