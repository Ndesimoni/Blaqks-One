/**
 * Agenda rows for the v2 Dashboard: follow-ups (due and overdue first, then the next open ones)
 * and upcoming viewings. Dates are read from the stored Dubai wall-clock text, so the labels
 * never shift with the computer's time zone.
 */
import { get } from '../../../lib/records.js';
import { isDue } from '../../../lib/crm.js';
import { dayOf } from '../../../lib/dubaiDate.js';
import { viewingClock } from './upcomingModel.js';

export const followUpLimit = 5;

const dayMonth = new Intl.DateTimeFormat('en-AE', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** "Today", or "15 Jan" for another stored day; an empty label when no day was recorded. */
export function dayLabel(value, today) {
  const day = dayOf(value);
  if (!day) return '';
  return day === today ? 'Today' : dayMonth.format(new Date(`${day}T12:00:00Z`));
}

const dueOf = (task) =>
  get(task, 'Due date') || get(task, 'Action due') || get(task, 'Next contact') || '';

/** When a follow-up is due: Overdue, Today, a short date or No date. */
export function followUpWhen(task, today) {
  const day = dayOf(dueOf(task));
  if (!day) return { label: 'No date', overdue: false };
  if (day < today) return { label: 'Overdue', overdue: true, detail: dayLabel(day, today) };
  return { label: dayLabel(day, today), overdue: false };
}

/** Due follow-ups first, then the remaining open ones, as the priorities list always ordered. */
export function agendaFollowUps(summary, limit = followUpLimit) {
  return [...summary.dueTasks, ...summary.tasks.filter((task) => !isDue(task))].slice(0, limit);
}

/** Day and time columns for a viewing entry (own or held-listing). */
export const viewingWhen = (at, today) => ({ day: dayLabel(at, today), time: viewingClock(at) });
