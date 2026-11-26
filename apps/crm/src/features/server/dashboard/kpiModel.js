import { get, isDone } from '../../../lib/records.js';
import { addDays, deadlineGroup, deadlineMoment } from '../followUps/deadlineModel.js';

const text = (value) => String(value ?? '').trim();

/** The Monday starting the Monday–Sunday week `today` (`YYYY-MM-DD`, Dubai) falls in. */
export const weekStart = (today) =>
  addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));

/** Open follow-ups due today and overdue, by the Follow-ups page's own deadline rule. */
export function followUpsDue(followUps, today) {
  const groups = (followUps || []).map((row) => deadlineGroup(row, today));
  return {
    today: groups.filter((group) => group === 'today').length,
    overdue: groups.filter((group) => group === 'overdue').length,
  };
}

/**
 * Leads added per Monday–Sunday week, oldest first, the last being this week so far (the
 * Leads page's "New this week"). `weeks` is how many weeks the trend shows.
 */
export function newLeadsByWeek(clients, today, weeks = 8) {
  const starts = Array.from({ length: weeks }, (_, index) =>
    addDays(weekStart(today), -7 * (weeks - 1 - index)),
  );
  return starts.map((start, index) => {
    const end = index === weeks - 1 ? today : addDays(start, 6);
    return (clients || []).filter((row) => {
      const added = text(get(row, 'Date added')).slice(0, 10);
      return added >= start && added <= end;
    }).length;
  });
}

/** Viewings booked on each day of this Monday–Sunday week; cancelled ones do not count. */
export function viewingsThisWeek(viewings, today) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart(today), index));
  const live = (viewings || []).filter((row) => !/cancel/i.test(text(get(row, 'Viewing status'))));
  return days.map(
    (day) =>
      live.filter((row) => deadlineMoment(get(row, 'Appointment date & time')).day === day).length,
  );
}

const closedStages = ['Completed', 'Lost', 'Cancelled'];

/** Deals in the Dashboard's workload: '' everyone, 'queue' unassigned, else one member's. */
export function workloadDeals(deals, filter) {
  if (!filter) return deals || [];
  return (deals || []).filter((deal) =>
    filter === 'queue' ? !deal.assignee : deal.assignee?.id === filter,
  );
}

/** The open pipeline: agreed value (fils) and count of deals not completed, lost or cancelled. */
export function openPipeline(deals) {
  const open = (deals || []).filter((deal) => !closedStages.includes(deal.stage));
  const fils = open.reduce((sum, deal) => sum + BigInt(deal.agreedValueFils || 0), 0n);
  return { fils: fils.toString(), count: open.length };
}

/**
 * Today's agenda (the mockup's Today table): open follow-ups due today and viewings booked
 * today, by time, untimed ones last. Each row keeps its module and record to open it.
 */
export function todayAgenda(data, today) {
  const followUps = (data['Follow-ups'] || [])
    .filter((row) => !isDone(get(row, 'Task status')) && deadlineGroup(row, today) === 'today')
    .map((record) => ({
      module: 'Follow-ups',
      record,
      time: deadlineMoment(get(record, 'Due date')).time,
      what: text(get(record, 'Next action')),
      clientId: text(get(record, 'Client ID')),
    }));
  const viewings = (data.Viewings || [])
    .filter((row) => !/cancel/i.test(text(get(row, 'Viewing status'))))
    .map((record) => ({ record, at: deadlineMoment(get(record, 'Appointment date & time')) }))
    .filter(({ at }) => at.day === today)
    .map(({ record, at }) => ({
      module: 'Viewings',
      record,
      time: at.time,
      propertyId: text(get(record, 'Property ID')),
      clientId: text(get(record, 'Client ID')),
    }));
  return [...followUps, ...viewings].sort((a, b) =>
    a.time === b.time ? 0 : !a.time ? 1 : !b.time ? -1 : a.time < b.time ? -1 : 1,
  );
}

const compact = new Intl.NumberFormat('en-AE', { notation: 'compact', maximumFractionDigits: 1 });

/** A fils amount as compact AED for a tile ("AED 18.4M", "AED 950K"). */
export const compactAed = (fils) => `AED ${compact.format(Number(BigInt(fils || 0) / 100n))}`;
