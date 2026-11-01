import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

const MUST = ['purpose', 'emirate', 'propertyType', 'bedrooms', 'budget', 'area', 'available'];
const PREFER = ['ready', 'furnishing', 'cheques', 'buildingAge', 'moveIn'];
const MARKS = { yes: '✓', no: '✗', unknown: '?' };

/**
 * The matching checklist as compact ticks: the must-match checks, then the preferences. The
 * server decides eligibility; preferences are descriptive and never block submission. Each
 * tick also says its result in words for screen readers, never by colour or mark alone.
 */
export function MarketplaceMatchChecklist({ checklist }) {
  const { t } = useI18n();
  const k = (key) => t(`marketplaceAnswers.${key}`);
  if (!checklist) return null;
  const tick = (key, value) => {
    const result = value === true ? 'yes' : value === false ? 'no' : 'unknown';
    return (
      <li key={key} className={`is-${result}`}>
        <span className="market-mark" aria-hidden="true">
          {MARKS[result]}
        </span>
        {k(`check.${key}`)}
        <span className="sr-only">: {k(result)}</span>
      </li>
    );
  };
  return (
    <section className="market-match" aria-label={k('checklist')}>
      {checklist.overBudget && <p className="market-warn">{k('overBudget')}</p>}
      <ul className="market-match-list">
        {MUST.map((key) => tick(key, checklist.checks?.[key]))}
        {PREFER.map((key) => tick(key, checklist.preferences?.[key]))}
      </ul>
    </section>
  );
}
