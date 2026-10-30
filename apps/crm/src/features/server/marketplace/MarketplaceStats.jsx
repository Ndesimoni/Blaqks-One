import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import './marketplace-stats.css';

/** Small, factual marketplace history. Unknown metrics remain unknown rather than zero. */
export function MarketplaceStats({ stats, compact = false }) {
  const { t, format } = useI18n();
  const k = (key, values) => t(`marketplaceAgreement.${key}`, values);
  if (!stats) return null;
  const rows = [
    [k('accepted'), format.number(stats.acceptedAgreements)],
    [k('completed'), format.number(stats.completedDeals)],
    [
      k('completionRate'),
      stats.completionRate === null
        ? k('noHistory')
        : `${format.number(stats.completionRate, { maximumFractionDigits: 1 })}%`,
    ],
    [
      k('response'),
      stats.averageResponseHours === null
        ? k('noHistory')
        : k('hours', {
            hours: format.number(stats.averageResponseHours, { maximumFractionDigits: 1 }),
          }),
    ],
  ];
  const facts = (
    <>
      <p className="market-hint">{k('statsScope')}</p>
      <dl className="record-review-grid market-review">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="market-hint">{k('responseScope')}</p>
      {stats.responseSamples !== null && (
        <p className="market-hint">{k('samples', { count: stats.responseSamples })}</p>
      )}
      <p className="market-hint">{k('disputesUnavailable')}</p>
    </>
  );
  return compact ? (
    <details className="market-stats">
      <summary>{k('completedCount', { count: stats.completedDeals })}</summary>
      {facts}
    </details>
  ) : (
    <section className="market-stats" aria-label={k('stats')}>
      <h3>{k('stats')}</h3>
      {facts}
    </section>
  );
}
