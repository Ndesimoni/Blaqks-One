import React, { useId, useMemo, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { COST_DEFAULTS, purchaseCosts } from '../../../lib/finance/calculators.js';
import { parseAed, parsePercent } from '../../../lib/finance/money.js';
import { CalcRow } from './CalcRow.jsx';
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
  const dld = parsePercent(draft.dld);
  const agency = parsePercent(draft.agency);
  const vat = parsePercent(draft.vat);
  const ratesInvalid = [dld, agency, vat].some((rate) => rate.error);
  const costs = useMemo(() => {
    if (price.error || price.value === null || ratesInvalid) return null;
    try {
      return purchaseCosts({
        priceFils: price.value,
        dldBp: dld.value ?? COST_DEFAULTS.dldBp,
        agencyBp: agency.value ?? COST_DEFAULTS.agencyBp,
        vatBp: vat.value ?? COST_DEFAULTS.vatBp,
      });
    } catch {
      return null;
    }
  }, [price.value, price.error, dld.value, agency.value, vat.value, ratesInvalid]);
  return (
    <section className="panel calc-card" aria-labelledby={`${uid}-title`}>
      <h3 id={`${uid}-title`}>{t('calculators.purchaseTitle')}</h3>
      <p className="calc-body">{t('calculators.purchaseBody')}</p>
      <div className="calc-grid">
        <CalculatorField
          id={`${uid}-price`}
          label={t('calculators.price')}
          prefix="AED"
          value={draft.price}
          onChange={update('price')}
          error={price.error ? 'calculators.invalidPrice' : ''}
          hint={t('calculators.priceHint')}
        />
        <CalculatorField
          id={`${uid}-dld`}
          label={t('calculators.dld')}
          suffix="%"
          value={draft.dld}
          onChange={update('dld')}
          error={dld.error ? 'calculators.invalidRate' : ''}
        />
        <CalculatorField
          id={`${uid}-agency`}
          label={t('calculators.agency')}
          suffix="%"
          value={draft.agency}
          onChange={update('agency')}
          error={agency.error ? 'calculators.invalidRate' : ''}
        />
        <CalculatorField
          id={`${uid}-vat`}
          label={t('calculators.vat')}
          suffix="%"
          value={draft.vat}
          onChange={update('vat')}
          error={vat.error ? 'calculators.invalidRate' : ''}
        />
      </div>
      <p className="calc-note">{t('calculators.defaultsNote')}</p>
      <section className="calc-results" aria-live="polite" aria-label={t('calculators.costs')}>
        <h4>{t('calculators.costs')}</h4>
        {costs ? (
          <dl>
            <CalcRow label={t('calculators.dldCost')} value={format.money(costs.dldFils)} />
            <CalcRow label={t('calculators.agencyCost')} value={format.money(costs.agencyFils)} />
            <CalcRow label={t('calculators.vatCost')} value={format.money(costs.vatFils)} />
            <CalcRow label={t('calculators.total')} value={format.money(costs.totalFils)} strong />
          </dl>
        ) : (
          <p className="calc-note">{t('calculators.prompt')}</p>
        )}
      </section>
    </section>
  );
}
