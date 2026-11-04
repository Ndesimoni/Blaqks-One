import React, { useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { MortgageCalculator } from './MortgageCalculator.jsx';
import { OffPlanCalculator } from './OffPlanCalculator.jsx';
import { PurchaseCalculator } from './PurchaseCalculator.jsx';
import { YieldCalculator } from './YieldCalculator.jsx';
import '../../records/grid/grid-filter.css';
import './calculators.css';

const calculators = [
  ['purchase', 'purchaseTitle', PurchaseCalculator],
  ['mortgage', 'mortgageTitle', MortgageCalculator],
  ['yield', 'yieldTitle', YieldCalculator],
  ['offPlan', 'offPlanTitle', OffPlanCalculator],
];

/**
 * Connected calculators as the approved mockup's Tools screen (design queue item 12): chips
 * choose one calculator; the others stay mounted, hidden, so their figures survive a switch.
 * Client-side estimates only; nothing is saved.
 */
export function ServerCalculators() {
  const { t } = useI18n();
  const [chosen, setChosen] = useState('purchase');
  return (
    <div className="page-stack calculators-page">
      <div className="calc-picker" role="group" aria-label={t('calculators.picker')}>
        {calculators.map(([id, title]) => (
          <button
            key={id}
            type="button"
            className="grid-chip"
            aria-pressed={id === chosen}
            onClick={() => setChosen(id)}
          >
            {t(`calculators.${title}`)}
          </button>
        ))}
      </div>
      {calculators.map(([id, , Calculator]) => (
        <div key={id} hidden={id !== chosen}>
          <Calculator />
        </div>
      ))}
    </div>
  );
}
