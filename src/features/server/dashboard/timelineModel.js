/**
 * Today's timeline (09:00–19:00, Asia/Dubai) for the v2 Dashboard: today's viewings, the
 * caller's held-listing viewings (time, property and agent only) and follow-ups due today.
 * Stored times are Dubai wall-clock text, so positions never depend on the computer's zone.
 */
import { get } from '../../../lib/records.js';
import { dayOf } from '../../../lib/dubaiDate.js';

export const DAY_START = 9 * 60;
export const DAY_END = 19 * 60;
export const hourMarks = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'];

/** Minutes after midnight from "YYYY-MM-DD HH:MM" (or "HH:MM"), or null without a time. */
export function minutesOf(value) {
  const match = /(?:^|[T ])(\d{2}):(\d{2})/.exec(String(value || ''));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

const clock = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Start offset as a percentage of the window, kept inside it so early or late items show. */
export function startPercent(minutes, width = 10) {
  const percent = ((minutes - DAY_START) / (DAY_END - DAY_START)) * 100;
  return Math.min(100 - width, Math.max(0, Math.round(percent * 10) / 10));
}

/** The "now" line position, or null outside the window. */
export function nowPercent(minutes) {
  if (minutes === null || minutes < DAY_START || minutes > DAY_END) return null;
  return Math.round(((minutes - DAY_START) / (DAY_END - DAY_START)) * 1000) / 10;
}

const dueOf = (task) =>
  get(task, 'Due date') || get(task, 'Action due') || get(task, 'Next contact') || '';

/**
 * `{ timed, untimed }` for `today`. Timed entries are sorted by time and carry `kind`
 * ('viewing', 'held' or 'follow-up'), `minutes`, `time` and the source entry or task;
 * follow-ups due today without a time are listed separately.
 */
export function todayTimeline({ viewings, dueTasks, today }) {
  const timed = [];
  const untimed = [];
  for (const entry of viewings) {
    const minutes = minutesOf(entry.at);
    if (dayOf(entry.at) !== today || minutes === null) continue;
    timed.push({ kind: entry.kind === 'held' ? 'held' : 'viewing', minutes, entry });
  }
  for (const task of dueTasks) {
    if (dayOf(dueOf(task)) !== today) continue;
    const minutes = minutesOf(dueOf(task));
    if (minutes === null) untimed.push(task);
    else timed.push({ kind: 'follow-up', minutes, task });
  }
  timed.sort((a, b) => a.minutes - b.minutes);
  return { timed: timed.map((item) => ({ ...item, time: clock(item.minutes) })), untimed };
}
