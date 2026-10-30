import React from 'react';
import { Empty } from '../../../components/ui/Empty.jsx';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { percentOf } from './shareModel.js';

const GAP = 0.8;

/** Donut segments on a circumference of 100, starting at twelve o'clock, with small gaps. */
function segments(tiers, total) {
  let start = 0;
  return tiers.map((tier, index) => {
    const share = (tier.value / total) * 100;
    const length = Math.max(0, share - (share < 100 ? GAP : 0));
    const segment = { index, length, offset: 25 - start };
    start += share;
    return segment;
  });
}

/** Lead quality as a donut with a complete legend (count and share), so colour is never alone. */
export function LeadTiers({ tiers }) {
  const total = tiers.reduce((sum, tier) => sum + tier.value, 0);
  const summary = tiers
    .map((tier) => `${tier.title} ${tier.value} (${percentOf(tier.value, total)}%)`)
    .join(', ');
  return (
    <section className="panel insight-panel" aria-label="Lead quality distribution">
      <TitleSection
        heading="Lead quality distribution"
        caption="Automatic tiers from the clients in view"
      />
      {total === 0 ? (
        <Empty
          title="No clients in view yet"
          detail="Lead tiers appear once clients are added."
          icon="users"
        />
      ) : (
        <div className="tier-donut-layout">
          <figure className="tier-donut" role="img" aria-label={`Lead quality: ${summary}`}>
            <svg viewBox="0 0 42 42" aria-hidden="true">
              <circle className="tier-donut-ring" cx="21" cy="21" r="15.915" />
              {segments(tiers, total).map((segment) =>
                segment.length > 0 ? (
                  <circle
                    key={segment.index}
                    className={`tier-donut-segment tier-c${segment.index + 1}`}
                    cx="21"
                    cy="21"
                    r="15.915"
                    strokeDasharray={`${segment.length} ${100 - segment.length}`}
                    strokeDashoffset={segment.offset}
                  />
                ) : null,
              )}
            </svg>
            <figcaption aria-hidden="true">
              <strong>{total}</strong>
              <span>{total === 1 ? 'client' : 'clients'}</span>
            </figcaption>
          </figure>
          <ul className="tier-legend" aria-label="Lead tiers">
            {tiers.map((tier, index) => (
              <li key={tier.title}>
                <span className={`tier-swatch tier-c${index + 1}`} aria-hidden="true" />
                <span className="tier-name">{tier.title}</span>
                <strong>{tier.value}</strong>
                <span className="tier-share">{percentOf(tier.value, total)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
