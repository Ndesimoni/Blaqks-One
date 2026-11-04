import React, { useId, useMemo, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { hu } from '../../../lib/finance/commission.js';
import { parseAed, parsePercent } from '../../../lib/finance/money.js';
import { MORTGAGE_DEFAULTS, mortgageRepayment } from '../../../lib/finance/mortgage.js';
import { CalcPanel } from './CalcPanel.jsx';
import { CalculatorField } from './CalculatorField.jsx';

const initial = { price: '', down: '20', rate: '4', years: '25' };
const labels = { price: 'price', down: 'downPayment', rate: 'rate', years: 'term' };

/** Whole years from 1 to 50; blank uses the 25-year default. */
function parseYears(text) {
  if (!text.trim()) return { value: MORTGAGE_DEFAULTS.termMonths / 12, error: '' };
  if (!/^\d+$/.test(text.trim())) return { value: null, error: 'invalid' };
  const years = Number(text);
  return years >= 1 && years <= 50
    ? { value: years, error: '' }
    : { value: null, error: 'invalid' };
}

/**
 * Q4 mortgage estimate, the down payment as a share of the price (the mockup's 20%). A 0%
 * rate repays exactly the principal; invalid terms are refused. Nothing is saved.
 */
export function MortgageCalculator() {
  const { t, format } = useI18n();
  const uid = useId();
  const [draft, setDraft] = useState(initial);
  const update = (key) => (value) => setDraft((current) => ({ ...current, [key]: value }));
  const price = parseAed(draft.price);
  const down = parsePercent(draft.down);
  const rate = parsePercent(draft.rate);
  const years = parseYears(draft.years);
  const result = useMemo(() => {
    if (price.error || price.value === null || down.error || rate.error || years.error) return null;
    try {
      return mortgageRepayment({
        priceFils: price.value,
        downPaymentFils: Number(hu(BigInt(price.value), BigInt(down.value ?? 0))),
        annualRateBp: rate.value ?? MORTGAGE_DEFAULTS.annualRateBp,
        termMonths: (years.value ?? 25) * 12,
      });
    } catch {
      return null;
    }
  }, [
    price.value,
    price.error,
    down.value,
    down.error,
    rate.value,
    rate.error,
    years.value,
    years.error,
  ]);
  const field = (key, unit, error) => (
    <CalculatorField
      id={`${uid}-${key}`}
      label={t(`calculators.${labels[key]}`)}
      unit={t(`calculators.${unit}`)}
      value={draft[key]}
      placeholder={key === 'price' ? t('calculators.pricePlaceholder') : undefined}
      onChange={update(key)}
      error={error}
    />
  );
  const money = format.money;
  const rows = result
    ? [
        { label: t('calculators.loan'), value: money(result.loanFils) },
        { label: t('calculators.monthly'), value: money(result.monthlyFils), strong: true },
        { label: t('calculators.interest'), value: money(result.interestFils) },
        { label: t('calculators.repaid'), value: money(result.totalFils) },
      ]
    : [];
  const shown = (key, unit) => `${draft[key].trim() || initial[key]} ${t(`calculators.${unit}`)}`;
  return (
    <CalcPanel
      title={t('calculators.mortgageTitle')}
      note={
        <>
          <p className="calc-note">{t('calculators.mortgageNote')}</p>
          {rate.value === 0 && <p className="calc-note">{t('calculators.zeroRate')}</p>}
        </>
      }
      result={{
        rows,
        ready: Boolean(result),
        prompt: t('calculators.mortgagePrompt'),
        inputs: result
          ? [
              [t('calculators.price'), money(price.value)],
              [t('calculators.downPayment'), shown('down', 'percentUnit')],
              [t('calculators.rate'), shown('rate', 'yearRate')],
              [t('calculators.term'), shown('years', 'years')],
            ]
          : [],
      }}
    >
      <div className="calc-fields">
        {field('price', 'aed', price.error ? 'calculators.invalidPrice' : '')}
        {field('down', 'percentUnit', down.error ? 'calculators.invalidRate' : '')}
        {field('rate', 'yearRate', rate.error ? 'calculators.invalidRate' : '')}
        {field('years', 'years', years.error ? 'calculators.invalidTerm' : '')}
      </div>
    </CalcPanel>
  );
}
