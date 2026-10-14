import React from 'react';
import { get } from '../../lib/records.js';
import { BarListPanel } from './BarListPanel.jsx';

const dealStages = ['New', 'Negotiation', 'Documentation', 'Offer', 'Completed'];

export function PipelinePanels({ data, sources, maxSource }) {
  const deals = dealStages.map((stage) => ({
    name: stage,
    count: data.Deals.filter(
      (d) => String(get(d, 'Deal stage') || '').toLowerCase() === stage.toLowerCase(),
    ).length,
  }));
  return (
    <>
      <BarListPanel
        heading="Deal pipeline"
        caption="Where your active opportunities stand"
        rows={deals}
        max={data.Deals.length}
        link={{ label: 'Manage deals', route: 'Deals' }}
      />
      <BarListPanel
        heading="Where leads come from"
        caption="Top channels bringing clients in"
        rows={sources.slice(0, 5)}
        max={maxSource}
        colorOffset={1}
        empty="No lead sources recorded."
        link={{ label: 'Explore insights', route: 'CRM insights' }}
      />
    </>
  );
}
