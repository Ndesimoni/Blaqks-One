import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';

/**
 * The off-plan Result lines: one per milestone ("Booking · 20% · 1 Dec 2026" and its amount)
 * once the schedule is ready, then the mockup's shares total with Ready to share or Must total
 * 100%. None while a share cannot be read.
 */
export function offPlanRows({ t, format, rows, schedule, totalBp, sharesValid }) {
  if (!sharesValid) return [];
  const lines = schedule
    ? schedule.milestones.map((milestone, index) => ({
        id: rows[index].id,
        label: [
          milestone.label,
          format.percent(milestone.percentBp),
          milestone.date && format.date(milestone.date),
        ]
          .filter(Boolean)
          .join(' · '),
        value: format.money(milestone.amountFils),
      }))
    : [];
  const ready = totalBp === 10_000;
  const status = t(ready ? 'calculators.ready' : 'calculators.mustTotal');
  return [
    ...lines,
    {
      id: 'total',
      label: t('calculators.sharesTotal', { share: format.percent(totalBp) }),
      value: <Badge tone={ready ? 'green' : 'amber'}>{status}</Badge>,
      text: status,
      strong: true,
    },
  ];
}
