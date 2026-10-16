/**
 * Key-figure derivations for the v2 connected Dashboard. Record figures use only the scoped
 * records the session received; finance figures use only the scoped `GET /finance` overview,
 * so the own view never derives a team or company figure. Days are Asia/Dubai calendar days.
 */
import { get } from '../../../lib/records.js';
import { dayOf, shiftDay } from '../../../lib/dubaiDate.js';
import { monthOf } from '../../../lib/dates.js';

/** Counts per 7-day week, oldest first, the last week ending `today`. */
export function weeklyCounts(days, today, weeks = 8) {
  const counts = Array(weeks).fill(0);
  const first = shiftDay(today, -7 * weeks + 1);
  for (const day of days) {
    if (!day || day < first || day > today) continue;
    const back = Math.round((Date.parse(today) - Date.parse(day)) / 86_400_000);
    counts[weeks - 1 - Math.floor(back / 7)] += 1;
  }
  return counts;
}

/** Counts per day from `today` for `count` days. */
export function dailyCounts(days, today, count = 7) {
  const window = Array.from({ length: count }, (_, index) => shiftDay(today, index));
  return window.map((day) => days.filter((value) => value === day).length);
}

/** The date a follow-up is due, read the same way as the shared due rule. */
const dueDay = (task) =>
  dayOf(get(task, 'Due date') || get(task, 'Action due') || get(task, 'Next contact'));

/** Due follow-ups split into overdue and due today. */
export function followUpSplit(dueTasks, today) {
  const dueToday = dueTasks.filter((task) => dueDay(task) === today).length;
  return { overdue: dueTasks.length - dueToday, today: dueToday };
}

/** Listings by status: Available, Under offer and everything else. */
export function propertyStatus(properties) {
  const status = (row) => String(get(row, 'Listing status') || '');
  const available = properties.filter((row) => /^available$/i.test(status(row))).length;
  const offer = properties.filter((row) => /^under offer$/i.test(status(row))).length;
  return [
    { name: 'Available', value: available, tone: 'accent' },
    { name: 'Under offer', value: offer, tone: 'amber' },
    { name: 'Other', value: properties.length - available - offer, tone: 'muted' },
  ];
}

const closedDeal = ['Completed', 'Lost', 'Cancelled'];
const dealGroups = [
  { name: 'Early', stages: ['New', 'Qualified', 'Viewing'], tone: 'blue' },
  { name: 'Negotiating', stages: ['Offer', 'Negotiation'], tone: 'accent' },
  { name: 'Contract', stages: ['Documentation'], tone: 'amber' },
  { name: 'On hold', stages: ['On hold'], tone: 'muted' },
];

/** Open deals (not completed, lost or cancelled) grouped by stage. */
export function openDeals(deals) {
  const open = deals.filter((deal) => !closedDeal.includes(deal.stage));
  return {
    count: open.length,
    segments: dealGroups.map((group) => ({
      name: group.name,
      tone: group.tone,
      value: open.filter((deal) => group.stages.includes(deal.stage)).length,
    })),
  };
}

/**
 * Fees earned in `month`, matching Performance: the team view sums each earned deal's gross
 * fee; the own view sums the caller's own commission statement lines.
 */
export function feesInMonth(overview, month) {
  if (overview.scope === 'team')
    return overview.deals
      .filter((deal) => monthOf(deal.earnedOn) === month && deal.calculation)
      .filter((deal) => !deal.calculation.preview)
      .reduce((sum, deal) => sum + deal.calculation.grossFils, 0);
  return overview.statement.lines
    .filter((line) => monthOf(line.earnedOn) === month)
    .reduce((sum, line) => sum + line.amountFils, 0);
}

/** The month's fees target for the finance scope shown (team or the caller), or null. */
export function feesTarget(targets, scope, me) {
  const member = scope === 'team' ? null : me;
  const target = (targets || []).find((row) => row.metric === 'fees' && row.memberId === member);
  return target && target.value > 0 ? target.value : null;
}

const grouped = new Intl.NumberFormat('en-AE', { maximumFractionDigits: 1 });

/** Fils as a short figure and unit for display: 3,860,000,000 fils → "38.6" + "M AED". */
export function compactAed(fils) {
  const aed = Math.max(0, fils) / 100;
  if (aed >= 1_000_000) return { figure: grouped.format(aed / 1_000_000), unit: 'M AED' };
  if (aed >= 10_000) return { figure: grouped.format(aed / 1_000), unit: 'K AED' };
  return { figure: grouped.format(Math.round(aed)), unit: 'AED' };
}

/** Short axis label for fils: "1.2M", "450K", "800". */
export function axisAed(fils) {
  const { figure, unit } = compactAed(fils);
  return `${figure}${unit.replace('AED', '').trim()}`;
}

/** Fils as one short money label: "AED 38.6M", "AED 12.5K", "AED 800". */
export function shortAed(fils) {
  const { figure, unit } = compactAed(fils);
  return `AED ${figure}${unit.replace('AED', '').trim()}`;
}
