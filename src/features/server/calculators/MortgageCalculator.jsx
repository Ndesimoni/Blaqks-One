import React, { useId, useMemo, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { parseAed, parsePercent } from '../../../lib/finance/money.js';
import { MORTGAGE_DEFAULTS, mortgageRepayment } from '../../../lib/finance/mortgage.js';
import { CalcRow } from './CalcRow.jsx';
import { CalculatorField } from './CalculatorField.jsx';

const initial = { price: '', down: '', rate: '4', years: '25' };

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
 * Q4 mortgage estimate. A 0% rate repays exactly the principal; invalid terms and down
 * payments above the price are refused. Nothing is saved.
 */
export function MortgageCalculator() {
  const { t, format } = useI18n();
  const uid = useId();
  const [draft, setDraft] = useState(initial);
  const update = (key) => (value) => setDraft((current) => ({ ...current, [key]: value }));
  const price = parseAed(draft.price);
  const down = parseAed(draft.down);
  const rate = parsePercent(draft.rate);
  const years = parseYears(draft.years);
  const downInvalid =
    Boolean(down.error) ||
    (down.value !== null && price.value !== null && down.value > price.value);
  const result = useMemo(() => {
    if (price.error || price.value === null || downInvalid || rate.error || years.error)
      return null;
    try {
      return mortgageRepayment({
        priceFils: price.value,
        downPaymentFils: down.value ?? 0,
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
    downInvalid,
    rate.value,
    rate.error,
    years.value,
    years.error,
  ]);
  return (
    <section className="panel calc-card" aria-labelledby={`${uid}-title`}>
      <h3 id={`${uid}-title`}>{t('calculators.mortgageTitle')}</h3>
      <p className="calc-body">{t('calculators.mortgageBody')}</p>
      <div className="calc-grid">
        <CalculatorField
          id={`${uid}-price`}
          label={t('calculators.price')}
          prefix="AED"
          value={draft.price}
          onChange={update('price')}
          error={price.error ? 'calculators.invalidPrice' : ''}
        />
        <CalculatorField
          id={`${uid}-down`}
          label={t('calculators.downPayment')}
          prefix="AED"
          value={draft.down}
          onChange={update('down')}
          error={
            downInvalid ? 'calculators.invalidDown' : down.error ? 'calculators.invalidAmount' : ''
          }
        />
        <CalculatorField
          id={`${uid}-rate`}
          label={t('calculators.rate')}
          suffix="%"
          value={draft.rate}
          onChange={update('rate')}
          error={rate.error ? 'calculators.invalidRate' : ''}
        />
        <CalculatorField
          id={`${uid}-term`}
          label={t('calculators.term')}
          value={draft.years}
          onChange={update('years')}
          error={years.error ? 'calculators.invalidTerm' : ''}
        />
      </div>
      {rate.value === 0 && !rate.error && <p className="calc-note">{t('calculators.zeroRate')}</p>}
      <section className="calc-results" aria-live="polite" aria-label={t('calculators.repayment')}>
        <h4>{t('calculators.repayment')}</h4>
        {result ? (
          <dl>
            <CalcRow label={t('calculators.loan')} value={format.money(result.loanFils)} />
            <CalcRow label={t('calculators.monthly')} value={format.money(result.monthlyFils)} />
            <CalcRow label={t('calculators.interest')} value={format.money(result.interestFils)} />
            <CalcRow
              label={t('calculators.repaid')}
              value={format.money(result.totalFils)}
              strong
            />
          </dl>
        ) : (
          <p className="calc-note">{t('calculators.mortgagePrompt')}</p>
        )}
      </section>
    </section>
  );
}
