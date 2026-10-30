/**
 * UAE purchase-cost calculator (packet Q3). Inputs are whole fils and basis points; every
 * product is half-up to the fils, matching the finance engine. DLD 4%, agency 2% and VAT 5%
 * are editable starting points, not legal advice. Nothing here writes to the database.
 */
import { hu } from './commission.js';
import { isBp, isFils } from './money.js';

export const COST_DEFAULTS = Object.freeze({ dldBp: 400, agencyBp: 200, vatBp: 500 });

const OUT_OF_RANGE = 'Calculator values are out of range.';

/**
 * `{ dldFils, agencyFils, vatFils, totalFils }` for a property price. VAT applies to the
 * agency fee only, never to the property price or the DLD transfer fee.
 */
export function purchaseCosts({
  priceFils,
  dldBp = COST_DEFAULTS.dldBp,
  agencyBp = COST_DEFAULTS.agencyBp,
  vatBp = COST_DEFAULTS.vatBp,
}) {
  if (!isFils(priceFils) || ![dldBp, agencyBp, vatBp].every(isBp))
    throw new RangeError(OUT_OF_RANGE);
  const price = BigInt(priceFils);
  const dld = hu(price, BigInt(dldBp));
  const agency = hu(price, BigInt(agencyBp));
  const vat = hu(agency, BigInt(vatBp));
  return {
    dldFils: Number(dld),
    agencyFils: Number(agency),
    vatFils: Number(vat),
    totalFils: Number(dld + agency + vat),
  };
}
