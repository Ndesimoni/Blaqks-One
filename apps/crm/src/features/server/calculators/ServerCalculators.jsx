import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { MortgageCalculator } from './MortgageCalculator.jsx';
import { OffPlanCalculator } from './OffPlanCalculator.jsx';
import { PurchaseCalculator } from './PurchaseCalculator.jsx';
import { YieldCalculator } from './YieldCalculator.jsx';
import './calculators.css';

/**
 * Connected calculators (packet Q3): client-side estimates only; nothing is saved. The shell
 * already shows the page title, so the page opens with its note.
 */
export function ServerCalculators() {
  const { t } = useI18n();
  return (
    <div className="page-stack calculators-page">
      <p className="calc-note">{t('calculators.intro')}</p>
      <PurchaseCalculator />
      <MortgageCalculator />
      <YieldCalculator />
      <OffPlanCalculator />
    </div>
  );
}
