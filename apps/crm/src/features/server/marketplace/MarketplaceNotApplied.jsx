import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceApplyButton } from './MarketplaceApplyButton.jsx';
import { MarketplaceChecklist } from './MarketplaceChecklist.jsx';
import { MarketplaceIntro } from './MarketplaceIntro.jsx';

/**
 * Not applied yet (broker marketplace §15): what the marketplace is, then the checklist with
 * its ticks and, once every line is met, the Admin's Apply button or "ask your Admin" for staff.
 */
export function MarketplaceNotApplied({ checklist, admin, onChanged }) {
  const { t } = useI18n();
  return (
    <div className="market-gate">
      <MarketplaceIntro>
        <p>{t('marketplace.notApplied.text')}</p>
      </MarketplaceIntro>
      <MarketplaceChecklist checklist={checklist}>
        <div className="market-apply">
          {!checklist.met && (
            <p className="market-hint">{t('marketplace.notApplied.incomplete')}</p>
          )}
          {checklist.met &&
            (admin ? (
              <MarketplaceApplyButton onApplied={onChanged} />
            ) : (
              <p className="market-hint">{t('marketplace.notApplied.staff')}</p>
            ))}
        </div>
      </MarketplaceChecklist>
    </div>
  );
}
