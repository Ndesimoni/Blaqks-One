/**
 * Connected CRM insights, derived only from what this session already holds: scoped client and
 * schedule records, and — with finance access — the deals in the scoped `GET /finance` view.
 */
import { OPTIONS } from '../../../config/fields.js';
import { leadTier } from '../../../lib/crm.js';
import { get } from '../../../lib/records.js';
import { selectWorkspaceSummary } from '../../../lib/workspace.js';

export const leadTiers = ['Hot', 'Warm', 'Nurture', 'Converted', 'Lost'];

const needsQualification = (client) =>
  !get(client, 'Funds confirmed') || !get(client, 'Decision maker');

/** Pipeline mix and lost reasons count deals only when `deals` is given (finance access). */
export function selectConnectedInsights(data, deals = null) {
  const clients = data.Clients || [];
  const summary = selectWorkspaceSummary(data);
  const tiers = leadTiers.map((title) => ({
    title,
    value: clients.filter((client) => leadTier(client) === title).length,
  }));
  const pipelines = deals
    ? OPTIONS['Pipeline type'].map((name) => ({
        name,
        value: deals.filter((deal) => deal.details?.pipeline_type === name).length,
      }))
    : null;
  const lostReasons = OPTIONS['Lost reason']
    .map((name) => ({
      name,
      value:
        clients.filter((client) => get(client, 'Lost reason') === name).length +
        (deals || []).filter((deal) => deal.details?.lost_cancelled_reason === name).length,
    }))
    .filter((row) => row.value > 0);
  return {
    hot: summary.hot.length,
    warm: summary.warm.length,
    dueTasks: summary.dueTasks.length,
    clientCare: summary.clientCare.length,
    tiers,
    tierTotal: Math.max(1, clients.length),
    pipelines,
    dealTotal: Math.max(1, deals?.length || 0),
    lostReasons,
    unqualified: clients.filter(needsQualification).slice(0, 4),
  };
}
