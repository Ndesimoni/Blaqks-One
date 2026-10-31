import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceApplyButton } from './MarketplaceApplyButton.jsx';
import { MarketplaceChecklist } from './MarketplaceChecklist.jsx';

/**
 * Not applied yet (broker marketplace §15): the checklist with its ticks, the Admin's Apply
 * button once every line is met, and "ask your Admin" for staff.
 */
export function MarketplaceNotApplied({ checklist, admin, onChanged }) {
  const { t } = useI18n();
  return (
    <>
      <section className="market-card">
        <h3>{t('marketplace.notApplied.title')}</h3>
        <p>{t('marketplace.notApplied.text')}</p>
        {!checklist.met && <p className="market-hint">{t('marketplace.notApplied.incomplete')}</p>}
        {checklist.met &&
          (admin ? (
            <MarketplaceApplyButton onApplied={onChanged} />
          ) : (
            <p className="market-hint">{t('marketplace.notApplied.staff')}</p>
          ))}
      </section>
      <MarketplaceChecklist checklist={checklist} />
    </>
  );
}
