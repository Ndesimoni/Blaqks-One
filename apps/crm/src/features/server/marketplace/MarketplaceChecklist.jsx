import React, { useId } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
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
 * The eligibility checklist (broker marketplace §15) as one card: how many lines are met, a
 * quiet progress bar, then one row per condition with its own tick and, for the Admin, the
 * count behind it (staff see the ticks only, MK1 code review L8). The platform sees the same
 * numbers, never the records. `children` holds the card's next step, such as Apply.
 */
export function MarketplaceChecklist({ checklist, children }) {
  const { t } = useI18n();
  const id = useId();
  const recent = checklist.lines ? checklist.lines.recent : checklist.recent;
  const rows = [
    ...COUNTED.map((entry) => line(t, checklist, entry)),
    [
      'recent',
      recent,
      recent ? t('marketplace.checklist.recentMet') : t('marketplace.checklist.recentMissing'),
    ],
  ];
  const met = rows.filter(([, done]) => done).length;
  return (
    <section className="market-card market-checklist-card" aria-labelledby={id}>
      <div className="market-card-head">
        <h2 id={id}>{t('marketplace.checklist.title')}</h2>
        <span className="market-progress">
          {t('marketplace.checklist.progress', { met, total: rows.length })}
        </span>
      </div>
      <div className="market-meter" aria-hidden="true">
        <span style={{ inlineSize: `${Math.round((met / rows.length) * 100)}%` }} />
      </div>
      <ul className="market-checklist">
        {rows.map(([key, done, detail]) => (
          <li key={key} className={done ? 'is-met' : 'is-missing'}>
            <span className="market-tick" aria-hidden="true">
              {done && <Icon name="check" size={13} strokeWidth={3} />}
            </span>
            <span className="market-line">{t(`marketplace.checklist.${key}`)}</span>
            {detail && <span className="market-detail">{detail}</span>}
            <span className="sr-only">
              {done ? t('marketplace.checklist.met') : t('marketplace.checklist.notMet')}
            </span>
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}
