/**
 * Connected Performance actuals, derived only from data this session already holds: scoped
 * records from `GET records` and the scoped `GET /finance` overview. No figure is requested
 * from the server as an aggregate, so assigned-only members see only their own work.
 */
import { get } from '../../../lib/records.js';
import { monthOf } from '../../../lib/dates.js';

export const performanceMetrics = [
  { key: 'enquiries', label: 'New enquiries' },
  { key: 'viewings', label: 'Completed viewings' },
  { key: 'deals', label: 'Completed deals', finance: true },
  { key: 'fees', label: 'Earned fees', finance: true, money: true },
];

/** Whose figures are shown: the whole team, one member, or the unassigned queue. */
export function performanceSelection(scope, filter, me) {
  if (scope !== 'team') return { kind: 'member', memberId: me };
  if (!filter) return { kind: 'team', memberId: null };
  if (filter === 'queue') return { kind: 'queue', memberId: null };
  return { kind: 'member', memberId: filter };
}

/**
 * Deal and fee figures appear only when the caller's finance view covers the selection: team
 * finance for the team or any member, own finance for the caller alone. Never a stand-in 0.
 */
export function financeCovers(access, selection, me) {
  if (selection.kind === 'queue') return false;
  if (access?.scope === 'team') return true;
  return access?.scope === 'own' && selection.kind === 'member' && selection.memberId === me;
}

export const visibleMetrics = (financeShown) =>
  performanceMetrics.filter((metric) => !metric.finance || financeShown);

/** `count` consecutive `YYYY-MM` months ending with `last`. */
export function monthsEnding(last, count = 12) {
  const [year, month] = last.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - count + index, 1));
    return date.toISOString().slice(0, 7);
  });
}

const blank = (months) => Object.fromEntries(months.map((month) => [month, 0]));

function tally(rows, monthFor, months) {
  const counts = blank(months);
  for (const row of rows) {
    const month = monthFor(row);
    if (month in counts) counts[month] += 1;
  }
  return counts;
}

/** New enquiries by Date added; completed viewings by appointment date. */
export function recordActuals(data, months) {
  const completed = (data.Viewings || []).filter(
    (row) => String(get(row, 'Viewing status') || '') === 'Completed',
  );
  return {
    enquiries: tally(data.Clients || [], (row) => monthOf(get(row, 'Date added')), months),
    viewings: tally(completed, (row) => monthOf(get(row, 'Appointment date & time')), months),
  };
}

/** A deal's earned fee for the selection: team gross fees, or the member's commission lines. */
function dealFee(deal, selection) {
  const calc = deal.calculation;
  if (!deal.earnedOn || !calc || calc.preview) return 0;
  if (selection.kind === 'team') return calc.grossFils;
  return calc.lines
    .filter((line) => line.agent?.id === selection.memberId)
    .reduce((sum, line) => sum + line.amountFils, 0);
}

/**
 * Completed deals (stage Completed, by closed date or else earned date) held by the selection,
 * and earned fees: the team view uses each earned deal's current snapshot, the same figures as
 * the Dashboard's Fees earned; the own view uses the caller's commission statement lines.
 */
export function financeActuals(overview, selection, months) {
  const own = overview.scope !== 'team';
  const held = overview.deals.filter(
    (deal) => selection.kind === 'team' || deal.assignee?.id === selection.memberId,
  );
  const deals = tally(
    held.filter((deal) => deal.stage === 'Completed'),
    (deal) => monthOf(deal.details?.closed_date || deal.earnedOn),
    months,
  );
  const fees = blank(months);
  const add = (month, fils) => {
    if (month in fees) fees[month] += fils;
  };
  if (own)
    for (const line of overview.statement.lines) add(monthOf(line.earnedOn), line.amountFils);
  else for (const deal of overview.deals) add(monthOf(deal.earnedOn), dealFee(deal, selection));
  return { deals, fees };
}

/** One row per month; finance metrics are `null` when they are not shown. */
export function performanceRows(data, overview, selection, months, financeShown) {
  const records = recordActuals(data, months);
  const finance = financeShown && overview ? financeActuals(overview, selection, months) : null;
  return months.map((month) => ({
    month,
    enquiries: records.enquiries[month],
    viewings: records.viewings[month],
    deals: finance ? finance.deals[month] : null,
    fees: finance ? finance.fees[month] : null,
  }));
}
