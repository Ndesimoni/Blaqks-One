import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import './marketplace-stats.css';

/**
 * Small, factual marketplace history as figure tiles, never stars (broker marketplace §7).
 * Unknown metrics remain unknown rather than zero, and disputes stay unavailable until MK5.
 * `compact` folds the tiles behind the completed-deals count on a board card.
 */
export function MarketplaceStats({ stats, compact = false }) {
  const { t, format } = useI18n();
  const k = (key, values) => t(`marketplaceAgreement.${key}`, values);
  if (!stats) return null;
  const rows = [
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
    [k('accepted'), format.number(stats.acceptedAgreements)],
  ];
  const facts = (
    <>
      <dl className="market-figures">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="market-hint">{k('statsScope')}</p>
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
    <section className="market-stats market-section" aria-label={k('stats')}>
      <h3>{k('stats')}</h3>
      {facts}
    </section>
  );
}
