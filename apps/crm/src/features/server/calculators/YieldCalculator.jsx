import React, { useId, useMemo, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { parseAed } from '../../../lib/finance/money.js';
import { yieldSummary } from '../../../lib/finance/yield.js';
import { CalcPanel } from './CalcPanel.jsx';
import { CalculatorField } from './CalculatorField.jsx';

const initial = { value: '', rent: '', costs: '', cash: '' };
const labels = { value: 'price', rent: 'annualRent', costs: 'annualCosts', cash: 'cashInvested' };

/**
 * Q5 rental yield and ROI estimate. A zero property value or zero cash invested leaves that
 * percentage blank instead of dividing by zero. Negative net income is shown as a loss.
 */
export function YieldCalculator() {
  const { t, format } = useI18n();
  const uid = useId();
  const [draft, setDraft] = useState(initial);
  const update = (key) => (value) => setDraft((current) => ({ ...current, [key]: value }));
  const parsed = {
    value: parseAed(draft.value),
    rent: parseAed(draft.rent),
    costs: parseAed(draft.costs),
    cash: parseAed(draft.cash),
  };
  const { value, rent, costs, cash } = parsed;
  const invalid = Object.values(parsed).some((field) => field.error);
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
  const field = (key) => (
    <CalculatorField
      id={`${uid}-${key}`}
      label={t(`calculators.${labels[key]}`)}
      unit={t('calculators.aed')}
      value={draft[key]}
      placeholder={key === 'value' ? t('calculators.pricePlaceholder') : undefined}
      onChange={update(key)}
      error={
        parsed[key].error
          ? key === 'value'
            ? 'calculators.invalidPrice'
            : 'calculators.invalidAmount'
          : ''
      }
    />
  );
  const rows = summary
    ? [
        { label: t('calculators.grossYield'), value: format.percent(summary.grossYieldBp) },
        { label: t('calculators.netYield'), value: format.percent(summary.netYieldBp) },
        { label: t('calculators.netIncome'), value: format.money(summary.netIncomeFils) },
        { label: t('calculators.roi'), value: format.percent(summary.roiBp), strong: true },
      ]
    : [];
  return (
    <CalcPanel
      title={t('calculators.yieldTitle')}
      note={<p className="calc-note">{t('calculators.yieldNote')}</p>}
      result={{
        rows,
        ready: Boolean(summary),
        prompt: t('calculators.yieldPrompt'),
        inputs: summary
          ? Object.keys(initial).map((key) => [
              t(`calculators.${labels[key]}`),
              format.money(parsed[key].value ?? 0),
            ])
          : [],
      }}
    >
      <div className="calc-fields">
        {field('value')}
        {field('rent')}
        {field('costs')}
        {field('cash')}
      </div>
    </CalcPanel>
  );
}
