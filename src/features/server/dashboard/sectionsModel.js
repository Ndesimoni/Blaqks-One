/**
 * Lead pipeline, lead source and team rows for the v2 Dashboard. Leads come from the scoped
 * records; team rows come only from a team-scope finance overview (`teamTotals.byAgent`) and
 * the targets the server returned to this caller.
 */
import { get } from '../../../lib/records.js';
import { monthOf } from '../../../lib/dates.js';
import { shares } from '../../../components/charts/chartGeometry.js';
import { sourceNames } from './dashboardModel.js';

const stageTone = (name) => (name === 'Closed' ? 'accent' : name === 'Lost' ? 'muted' : 'blue');

/** Pipeline rows in stage order with a tone: closed leads in the accent, lost ones muted. */
export const pipelineRows = (stages) =>
  stages.map((row) => ({ ...row, tone: stageTone(row.name) }));

/** The three largest sources take the accent, blue and amber; the rest stay muted. */
const tones = ['accent', 'blue', 'amber'];

/** The listed source, Other for an unlisted value, or Not recorded when blank. */
function sourceOf(client) {
  const value = String(get(client, 'Lead source') || '').trim();
  if (!value) return 'Not recorded';
  return sourceNames.includes(value) ? value : 'Other';
}

/**
 * One row per source with leads, share and closed leads; rows always total every client.
 * Most leads first; Other and Not recorded follow the named channels.
 */
export function sourceRows(clients) {
  const rows = new Map();
  for (const client of clients) {
    const name = sourceOf(client);
    const row = rows.get(name) || { name, count: 0, closed: 0 };
    row.count += 1;
    if (/closed/i.test(String(get(client, 'Lead stage') || ''))) row.closed += 1;
    rows.set(name, row);
  }
  const rank = (row) => (row.name === 'Not recorded' ? 2 : row.name === 'Other' ? 1 : 0);
  const sorted = [...rows.values()].sort((a, b) => rank(a) - rank(b) || b.count - a.count);
  const percent = shares(sorted.map((row) => row.count));
  return sorted.map((row, index) => ({
    ...row,
    share: percent[index],
    tone: rank(row) ? 'muted' : tones[index] || 'muted',
  }));
}

/** The member's own commission lines on deals earned in `month` (team view only). */
function memberFeesInMonth(deals, memberId, month) {
  return deals
    .filter((deal) => monthOf(deal.earnedOn) === month && deal.calculation)
    .filter((deal) => !deal.calculation.preview)
    .flatMap((deal) => deal.calculation.lines)
    .filter((line) => line.agent?.id === memberId)
    .reduce((sum, line) => sum + line.amountFils, 0);
}

/**
 * Team table rows from a team-scope overview: deals held, commission earned and received
 * (as the server totals them) and this month's commission against the member's fees target
 * when the server returned one. Returns [] for any other scope.
 */
export function teamRows(overview, targets, month) {
  if (overview?.scope !== 'team' || !overview.teamTotals) return [];
  return overview.teamTotals.byAgent
    .map((row) => {
      const target = (targets || []).find(
        (item) => item.metric === 'fees' && item.memberId === row.agent.id,
      );
      return {
        id: row.agent.id,
        name: row.agent.name,
        deals: overview.deals.filter((deal) => deal.assignee?.id === row.agent.id).length,
        earnedFils: row.earnedFils,
        receivedFils: row.receivedShareFils,
        monthFils: memberFeesInMonth(overview.deals, row.agent.id, month),
        targetFils: target && target.value > 0 ? target.value : null,
      };
    })
    .sort((a, b) => b.earnedFils - a.earnedFils || a.name.localeCompare(b.name));
}
