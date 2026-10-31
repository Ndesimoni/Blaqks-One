/**
 * Rental yield and ROI estimate (packet Q5). Money is whole fils. Gross yield uses annual
 * rent over property value; net yield uses rent after annual costs; ROI uses net income over
 * the cash invested. A zero denominator returns `null` instead of infinity. Negative net
 * income is allowed and reported, but these are estimates, never guaranteed returns.
 */
import { isFils } from './money.js';

const invalid = () => new RangeError('Yield values are out of range.');

/** Signed percentage in basis points, rounded half-up; `null` when the whole is zero. */
function ratioBp(part, whole) {
  if (whole <= 0n) return null;
  const negative = part < 0n;
  const top = negative ? -part : part;
  const bp = (top * 20_000n + whole) / (2n * whole);
  return Number(negative ? -bp : bp);
}

/**
 * `{ netIncomeFils, grossYieldBp, netYieldBp, roiBp }`. `grossYieldBp` and `netYieldBp` are
 * null without a positive property value; `roiBp` is null without positive cash invested.
 */
export function yieldSummary({
  propertyValueFils,
  annualRentFils,
  annualCostsFils,
  cashInvestedFils,
}) {
  const values = [propertyValueFils, annualRentFils, annualCostsFils, cashInvestedFils];
  if (!values.every(isFils)) throw invalid();
  const [value, rent, costs, cash] = values.map((amount) => BigInt(amount));
  const netIncome = rent - costs;
  return {
    netIncomeFils: Number(netIncome),
    grossYieldBp: ratioBp(rent, value),
    netYieldBp: ratioBp(netIncome, value),
    roiBp: ratioBp(netIncome, cash),
  };
}
