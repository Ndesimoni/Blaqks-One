import React, { useId, useMemo, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { parseAed } from '../../../lib/finance/money.js';
import { yieldSummary } from '../../../lib/finance/yield.js';
import { CalcRow } from './CalcRow.jsx';
import { CalculatorField } from './CalculatorField.jsx';

const initial = { value: '', rent: '', costs: '', cash: '' };

/**
 * Q5 rental yield and ROI estimate. A zero property value or zero cash invested leaves that
 * percentage blank instead of dividing by zero. Negative net income is shown as a loss.
 */
export function YieldCalculator() {
  const { t, format } = useI18n();
  const uid = useId();
  const [draft, setDraft] = useState(initial);
  const update = (key) => (value) => setDraft((current) => ({ ...current, [key]: value }));
  const value = parseAed(draft.value);
  const rent = parseAed(draft.rent);
  const costs = parseAed(draft.costs);
  const cash = parseAed(draft.cash);
  const invalid = [value, rent, costs, cash].some((field) => field.error);
  const summary = useMemo(() => {
    if (value.error || value.value === null || invalid) return null;
    try {
      return yieldSummary({
        propertyValueFils: value.value,
        annualRentFils: rent.value ?? 0,
        annualCostsFils: costs.value ?? 0,
        cashInvestedFils: cash.value ?? 0,
      });
    } catch {
      return null;
    }
  }, [value.value, value.error, rent.value, costs.value, cash.value, invalid]);
  const amountError = (field) => (field.error ? 'calculators.invalidAmount' : '');
  return (
    <section className="panel calc-card" aria-labelledby={`${uid}-title`}>
      <h3 id={`${uid}-title`}>{t('calculators.yieldTitle')}</h3>
      <p className="calc-body">{t('calculators.yieldBody')}</p>
      <div className="calc-grid">
        <CalculatorField
          id={`${uid}-value`}
          label={t('calculators.price')}
          prefix="AED"
          value={draft.value}
          onChange={update('value')}
          error={value.error ? 'calculators.invalidPrice' : ''}
        />
        <CalculatorField
          id={`${uid}-rent`}
          label={t('calculators.annualRent')}
          prefix="AED"
          value={draft.rent}
          onChange={update('rent')}
          error={amountError(rent)}
        />
        <CalculatorField
          id={`${uid}-costs`}
          label={t('calculators.annualCosts')}
          prefix="AED"
          value={draft.costs}
          onChange={update('costs')}
          error={amountError(costs)}
          hint={t('calculators.costsHint')}
        />
        <CalculatorField
          id={`${uid}-cash`}
          label={t('calculators.cashInvested')}
          prefix="AED"
          value={draft.cash}
          onChange={update('cash')}
          error={amountError(cash)}
          hint={t('calculators.cashHint')}
        />
      </div>
      <p className="calc-note">{t('calculators.yieldNote')}</p>
      <section className="calc-results" aria-live="polite" aria-label={t('calculators.yieldTitle')}>
        <h4>{t('calculators.yieldTitle')}</h4>
        {summary ? (
          <dl>
            <CalcRow
              label={t('calculators.grossYield')}
              value={format.percent(summary.grossYieldBp)}
            />
            <CalcRow label={t('calculators.netYield')} value={format.percent(summary.netYieldBp)} />
            <CalcRow
              label={t('calculators.netIncome')}
              value={format.money(summary.netIncomeFils)}
            />
            <CalcRow label={t('calculators.roi')} value={format.percent(summary.roiBp)} strong />
          </dl>
        ) : (
          <p className="calc-note">{t('calculators.yieldPrompt')}</p>
        )}
      </section>
    </section>
  );
}
