import React, { useId, useMemo, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { COST_DEFAULTS, purchaseCosts } from '../../../lib/finance/calculators.js';
import { parseAed, parsePercent } from '../../../lib/finance/money.js';
import { CalcPanel } from './CalcPanel.jsx';
import { CalculatorField } from './CalculatorField.jsx';

const initial = { price: '', dld: '4', agency: '2', vat: '5' };

/**
 * Q3 purchase-cost calculator. DLD 4%, agency 2% and VAT 5% are editable defaults; clearing a
 * rate restores its default. VAT is charged on the agency fee only. No record is saved.
 */
export function PurchaseCalculator() {
  const { t, format } = useI18n();
  const uid = useId();
  const [draft, setDraft] = useState(initial);
  const update = (key) => (value) => setDraft((current) => ({ ...current, [key]: value }));
  const price = parseAed(draft.price);
  const rates = {
    dld: parsePercent(draft.dld),
    agency: parsePercent(draft.agency),
    vat: parsePercent(draft.vat),
  };
  const ratesInvalid = Object.values(rates).some((rate) => rate.error);
  const costs = useMemo(() => {
    if (price.error || price.value === null || ratesInvalid) return null;
    try {
      return purchaseCosts({
        priceFils: price.value,
        dldBp: rates.dld.value ?? COST_DEFAULTS.dldBp,
        agencyBp: rates.agency.value ?? COST_DEFAULTS.agencyBp,
        vatBp: rates.vat.value ?? COST_DEFAULTS.vatBp,
      });
    } catch {
      return null;
    }
  }, [
    price.value,
    price.error,
    rates.dld.value,
    rates.agency.value,
    rates.vat.value,
    ratesInvalid,
  ]);
  const rate = (key) => (
    <CalculatorField
      id={`${uid}-${key}`}
      label={t(`calculators.${key}`)}
      unit={t('calculators.percentUnit')}
      value={draft[key]}
      onChange={update(key)}
      error={rates[key].error ? 'calculators.invalidRate' : ''}
    />
  );
  const money = format.money;
  const rows = costs
    ? [
        { label: t('calculators.dld'), value: money(costs.dldFils) },
        { label: t('calculators.agency'), value: money(costs.agencyFils) },
        { label: t('calculators.vat'), value: money(costs.vatFils) },
        { label: t('calculators.total'), value: money(costs.totalFils), strong: true },
        { label: t('calculators.cashNeeded'), value: money(price.value + costs.totalFils) },
      ]
    : [];
  const percent = (key) => `${draft[key].trim() || initial[key]}%`;
  return (
    <CalcPanel
      title={t('calculators.purchaseTitle')}
      note={<p className="calc-note">{t('calculators.purchaseNote')}</p>}
      result={{
        rows,
        ready: Boolean(costs),
        prompt: t('calculators.prompt'),
        inputs: costs
          ? [
              [t('calculators.price'), money(price.value)],
              ...['dld', 'agency', 'vat'].map((key) => [t(`calculators.${key}`), percent(key)]),
            ]
          : [],
      }}
    >
      <div className="calc-fields">
        <CalculatorField
          id={`${uid}-price`}
          label={t('calculators.price')}
          unit={t('calculators.aed')}
          value={draft.price}
          placeholder={t('calculators.pricePlaceholder')}
          onChange={update('price')}
          error={price.error ? 'calculators.invalidPrice' : ''}
        />
        {rate('dld')}
        {rate('agency')}
        {rate('vat')}
      </div>
    </CalcPanel>
  );
}
