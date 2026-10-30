import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { MINIMUMS } from './marketplaceMinimums.js';

const COUNTED = [
  ['age', 'ageDays'],
  ['properties', 'properties'],
  ['clients', 'clients'],
  ['contacts', 'contacts'],
  ['followUps', 'followUps'],
  ['viewings', 'viewings'],
];

/** One line: the server's tick when it sends one, and the count only when the Admin reads. */
function line(t, checklist, [key, field]) {
  const value = checklist[field];
  const met = checklist.lines ? checklist.lines[key] : value >= MINIMUMS[key];
  if (value === null) return [key, met, ''];
  const detail =
    key === 'age'
      ? t('marketplace.checklist.ageDays', { days: value })
      : t('marketplace.checklist.count', { count: value, need: MINIMUMS[key] });
  return [key, met, detail];
}

/**
 * The eligibility checklist (broker marketplace §15), one line per condition with its own
 * tick. The Admin also sees the counts behind each tick; staff see the ticks only (MK1 code
 * review L8). The platform sees the same numbers, never the records.
 */
export function MarketplaceChecklist({ checklist }) {
  const { t } = useI18n();
  const recent = checklist.lines ? checklist.lines.recent : checklist.recent;
  const rows = [
    ...COUNTED.map((entry) => line(t, checklist, entry)),
    [
      'recent',
      recent,
      recent ? t('marketplace.checklist.recentMet') : t('marketplace.checklist.recentMissing'),
    ],
  ];
  return (
    <section className="market-card" aria-label={t('marketplace.checklist.title')}>
      <h3>{t('marketplace.checklist.title')}</h3>
      <ul className="market-checklist">
        {rows.map(([key, met, detail]) => (
          <li key={key} className={met ? 'is-met' : 'is-missing'}>
            <span className="market-tick" aria-hidden="true">
              {met ? '✓' : '✗'}
            </span>
            <span className="market-line">
              {t(`marketplace.checklist.${key}`)}
              {detail && <span className="market-detail">{detail}</span>}
            </span>
            <span className="sr-only">
              {met ? t('marketplace.checklist.met') : t('marketplace.checklist.notMet')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
