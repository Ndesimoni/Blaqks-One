import { leadTier } from '../../lib/crm.js';
import { OPTIONS } from '../../config/fields.js';
import { get } from '../../lib/records.js';

export function selectInsights(data) {
  const tiers = ['Hot', 'Warm', 'Nurture', 'Converted', 'Lost'];
  const counts = tiers.map((t) => ({
    title: t,
    value: data.Clients.filter((x) => leadTier(x) === t).length,
  }));
  const total = Math.max(1, data.Clients.length);
  const pipelineTypes = OPTIONS['Pipeline type'].map((name) => ({
    name,
    value: data.Deals.filter((d) => get(d, 'Pipeline type') === name).length,
  }));
  const lostReasons = OPTIONS['Lost reason']
    .map((name) => ({
      name,
      value:
        data.Clients.filter((c) => get(c, 'Lost reason') === name).length +
        data.Deals.filter((d) => get(d, 'Lost / cancelled reason') === name).length,
    }))
    .filter((x) => x.value > 0);
  return { tiers, counts, total, pipelineTypes, lostReasons };
}
