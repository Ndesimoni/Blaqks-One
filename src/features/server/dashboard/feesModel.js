/**
 * "Fees received · 12 months" for the v2 Dashboard, from the scoped finance overview only.
 * Team view: approved payments by receipt month (amounts exclude VAT; pending, rejected and
 * void payments never count). Own view: the caller's commission statement lines by earned
 * month, so no company or team figure is ever derived for an own-scope member.
 */
import { monthOf } from '../../../lib/dates.js';
import { monthsEnding } from '../performance/performanceModel.js';

const monthName = new Intl.DateTimeFormat('en-AE', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthShort = new Intl.DateTimeFormat('en-AE', { month: 'short', timeZone: 'UTC' });
const asDate = (month) => new Date(`${month}-01T12:00:00Z`);

/** `[month, fils]` entries for the overview's scope. */
function entries(overview) {
  if (overview.scope === 'team')
    return overview.payments
      .filter((payment) => payment.status === 'approved')
      .map((payment) => [monthOf(payment.receiptDate), payment.amountFils]);
  return overview.statement.lines.map((line) => [monthOf(line.earnedOn), line.amountFils]);
}

/** Sums per `YYYY-MM` month across the given months (zero when nothing was received). */
export function monthlyTotals(overview, months) {
  const totals = Object.fromEntries(months.map((month) => [month, 0]));
  for (const [month, fils] of entries(overview)) if (month in totals) totals[month] += fils;
  return totals;
}

const previousYear = (month) => `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;

const sum = (values) => values.reduce((total, value) => total + value, 0);
const changeOf = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

/** Deals completed in any of `months` (closed date, else earned date) among those in view. */
const closedIn = (deals, months) =>
  deals.filter(
    (deal) =>
      deal.stage === 'Completed' &&
      months.includes(monthOf(deal.details?.closed_date || deal.earnedOn)),
  ).length;

/**
 * Twelve months ending `month`, each with the same month a year earlier: `{ points, total,
 * previousTotal, change, latest, empty, team }`. `change` is the whole-percent change of the
 * 12-month total against the 12 months before, or null when there is no earlier figure. The
 * latest point carries `closed`, the deals completed that month among the deals in view, and
 * `closed` on the series counts them over the 12 months.
 */
export function feesSeries(overview, month) {
  const months = monthsEnding(month, 12);
  const totals = monthlyTotals(overview, [...months.map(previousYear), ...months]);
  const points = months.map((key) => ({
    month: key,
    label: monthShort.format(asDate(key)),
    name: monthName.format(asDate(key)),
    current: totals[key],
    previous: totals[previousYear(key)],
  }));
  const total = sum(points.map((point) => point.current));
  const previousTotal = sum(points.map((point) => point.previous));
  const deals = overview.deals || [];
  const latest = { ...points.at(-1), closed: closedIn(deals, [month]) };
  return {
    points,
    total,
    previousTotal,
    change: changeOf(total, previousTotal),
    closed: closedIn(deals, months),
    latest,
    empty: !total && !previousTotal,
    team: overview.scope === 'team',
  };
}
