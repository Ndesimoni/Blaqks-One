import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

const MUST = ['purpose', 'emirate', 'propertyType', 'bedrooms', 'budget', 'area', 'available'];
const PREFER = ['ready', 'furnishing', 'cheques', 'buildingAge', 'moveIn'];

/** The server decides eligibility; preferences are descriptive and never block submission. */
export function MarketplaceMatchChecklist({ checklist }) {
  const { t } = useI18n();
  const k = (key) => t(`marketplaceAnswers.${key}`);
  if (!checklist) return null;
  return (
    <section aria-label={k('checklist')}>
      <h4>{k('checklist')}</h4>
      {checklist.overBudget && <p className="market-hint">{k('overBudget')}</p>}
      <dl className="market-match-checklist">
        {[...MUST, ...PREFER].map((key) => {
          const value = (MUST.includes(key) ? checklist.checks : checklist.preferences)?.[key];
          return (
            <div key={key}>
              <dt>{k(`check.${key}`)}</dt>
              <dd>{k(value === true ? 'yes' : value === false ? 'no' : 'unknown')}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
