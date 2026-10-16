/**
 * Connected Dashboard rules. Every figure is derived from the records the server already returned
 * for this session, so assigned-only members count only their own records and hidden records
 * never reach a total. Finance figures come only from `GET /finance` (see financeDashboard.js).
 */
import { get } from '../../../lib/records.js';
import { selectWorkspaceSummary } from '../../../lib/workspace.js';
import { stageAndListingOptions } from '../../../config/fields/stageAndListingOptions.js';
import { canOpenSection } from '../access.js';
import { canUseFinance } from '../finance/financeAccess.js';
import { connectedCollections } from '../records.js';
import { assignmentCollections, filterAssignedEntries } from '../assignment/assignmentModel.js';
import { upcomingViewings } from './upcomingModel.js';

/** Widgets backed by connected collections the member may open; unconnected ones never show. */
export function dashboardWidgets(user) {
  const open = (section) => canOpenSection(user, section);
  return {
    leads: open('Clients'),
    properties: open('Properties'),
    schedule: open('Follow-ups'),
    finance: open('Deals') && canUseFinance(user),
    collections: connectedCollections.filter(open),
  };
}

/** The collection whose assignee list feeds the workload filter, or null when none applies. */
export function workloadModule(user, scope) {
  if (scope !== 'team') return null;
  return assignmentCollections.find((name) => canOpenSection(user, name)) || null;
}

/**
 * One member's workload ('' = everyone, 'queue' = unassigned). Assignable collections use their
 * holder; other activity follows its linked client, as the member's own view would.
 */
export function filterWorkload(entries, data, filter) {
  if (!filter) return data;
  const next = { ...data };
  for (const name of assignmentCollections)
    next[name] = filterAssignedEntries(entries, name, filter).map((entry) => entry.record);
  const clients = new Set(next.Clients.map((row) => row.client_id));
  for (const name of connectedCollections.filter((item) => !assignmentCollections.includes(item)))
    next[name] = (data[name] || []).filter((row) => row.client_id && clients.has(row.client_id));
  return next;
}

export const workloadCount = (data) =>
  assignmentCollections.reduce((total, name) => total + (data[name] || []).length, 0);

function tally(records, label, names) {
  return names
    .map((name) => ({
      name,
      count: records.filter((row) => String(get(row, label) || '') === name).length,
    }))
    .filter((row) => row.count > 0);
}

const sourceNames = ['Instagram', 'Referral', 'Property Finder', 'Bayut', 'Website', 'TikTok'];

/** Lead sources including any unlisted values under Other, so the bars always sum to the total. */
function leadSources(clients) {
  const named = tally(clients, 'Lead source', sourceNames);
  const other = clients.length - named.reduce((sum, row) => sum + row.count, 0);
  const unknown = clients.filter((row) => !get(row, 'Lead source')).length;
  return [
    ...named,
    ...(other - unknown > 0 ? [{ name: 'Other', count: other - unknown }] : []),
  ].sort((a, b) => b.count - a.count);
}

export function selectConnectedDashboard(data) {
  const summary = selectWorkspaceSummary(data);
  const stages = tally(data.Clients, 'Lead stage', stageAndListingOptions['Lead stage']);
  const sources = leadSources(data.Clients);
  return {
    openLeads: summary.openLeads,
    hot: summary.hot,
    tasks: summary.tasks,
    dueTasks: summary.dueTasks,
    upcoming: upcomingViewings(data.Viewings),
    properties: data.Properties.length,
    available: data.Properties.filter((row) => /^available$/i.test(get(row, 'Listing status')))
      .length,
    stages,
    maxStage: Math.max(1, ...stages.map((row) => row.count)),
    sources,
    maxSource: Math.max(1, ...sources.map((row) => row.count)),
    counts: Object.fromEntries(connectedCollections.map((name) => [name, data[name].length])),
  };
}

const nameKeys = {
  Clients: ['client_id', 'full_name'],
  Properties: ['property_id', 'listing_title'],
};

/**
 * Display name for a linked client or property. Hidden records use the server's permitted label
 * (task clients and references) or an explicit unavailable label, never other record details.
 */
export function linkedName(data, referenceFor, collection, id) {
  if (!id) return '—';
  const [idKey, nameKey] = nameKeys[collection];
  const found = data[collection].find((row) => row[idKey] === id);
  if (found) return found[nameKey] || id;
  const reference = referenceFor?.(collection, id);
  return reference ? reference.label : `${id} · Linked record unavailable`;
}
