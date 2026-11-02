/**
 * The approved mockup's Performance figures (design queue item 9), derived like the rest of the
 * page only from data this session already holds: closed deals and their fees from the scoped
 * finance overview, lead response from scoped Clients, Interaction log and Follow-ups.
 */
import { monthOf } from '../../../lib/dates.js';
import { get } from '../../../lib/records.js';

const dayOf = (value) => /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? '').trim())?.[1] || '';
const daysBetween = (from, to) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
const average = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/** Completed deals held by the selection that closed in `month` (closed date, else earned). */
export function closedDeals(overview, selection, month) {
  return (overview?.deals || []).filter(
    (deal) =>
      deal.stage === 'Completed' &&
      (selection.kind === 'team' || deal.assignee?.id === selection.memberId) &&
      monthOf(deal.details?.closed_date || deal.earnedOn) === month,
  );
}

/** Average days from a deal's opened date to its close, over closed deals that have both. */
export function daysToClose(deals) {
  const spans = deals
    .map((deal) => [
      dayOf(deal.details?.opened_date),
      dayOf(deal.details?.closed_date || deal.earnedOn),
    ])
    .filter(([opened, closed]) => opened && closed && closed >= opened)
    .map(([opened, closed]) => daysBetween(opened, closed));
  const days = average(spans);
  return { days: days === null ? null : Math.round(days), measured: spans.length };
}

/**
 * Lead response for leads added in `month`: days from the day a lead was added to its first
 * logged contact (a conversation or a follow-up's contact date) on or after that day. Leads
 * record only the day they arrived, so this is measured in days, never hours.
 */
export function leadResponse(data, month) {
  const first = new Map();
  const note = (clientId, day) => {
    if (!clientId || !day) return;
    first.set(clientId, [...(first.get(clientId) || []), day]);
  };
  for (const row of data['Interaction log'] || [])
    note(get(row, 'Client ID'), dayOf(get(row, 'Contacted on UAE time')));
  for (const row of data['Follow-ups'] || [])
    note(get(row, 'Client ID'), dayOf(get(row, 'Contact date')));
  const spans = (data.Clients || [])
    .map((client) => [get(client, 'Client ID'), dayOf(get(client, 'Date added'))])
    .filter(([, added]) => added && added.slice(0, 7) === month)
    .map(([id, added]) => {
      const later = (first.get(id) || []).filter((day) => day >= added).sort();
      return later.length ? daysBetween(added, later[0]) : null;
    })
    .filter((span) => span !== null);
  const days = average(spans);
  return { days, measured: spans.length };
}

/** A completed deal's earned gross fee in fils; 0 while it is unearned or an estimate. */
const grossFee = (deal) =>
  deal.earnedOn && deal.calculation && !deal.calculation.preview ? deal.calculation.grossFils : 0;

/**
 * Deals won per agent in the closed deals (the mockup's "Deals won by agent"), most first:
 * `{ id, name, count, fils }`, the unassigned queue as `id: null`.
 */
export function agentWins(deals) {
  const agents = new Map();
  for (const deal of deals) {
    const id = deal.assignee?.id ?? null;
    const row = agents.get(id) || { id, name: deal.assignee?.name || '', count: 0, fils: 0 };
    row.count += 1;
    row.fils += Number(grossFee(deal));
    agents.set(id, row);
  }
  return [...agents.values()].sort((a, b) => b.count - a.count || b.fils - a.fils);
}
