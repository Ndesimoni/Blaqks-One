/**
 * Mortgage repayment estimate (packet Q4). Prices are whole fils, the annual rate is basis
 * points and the term is whole months. The monthly payment uses the standard annuity formula
 * and rounds half-up to the fils; a zero-rate loan repays exactly its principal, so no
 * interest is invented by rounding. This is an estimate only: bank fees and insurance are
 * outside it, and nothing is saved.
 */
import { isBp, isFils } from './money.js';

export const MORTGAGE_DEFAULTS = Object.freeze({ annualRateBp: 400, termMonths: 300 });
export const MAX_TERM_MONTHS = 600;

const invalid = () => new RangeError('Mortgage values are out of range.');

/**
 * `{ loanFils, monthlyFils, totalFils, interestFils }` for a property price, down payment,
 * annual rate and term. A down payment above the price, a zero or non-integer term, a term
 * over 50 years, or a rate outside 0–100% is refused.
 */
export function mortgageRepayment({
  priceFils,
  downPaymentFils = 0,
  annualRateBp = MORTGAGE_DEFAULTS.annualRateBp,
  termMonths = MORTGAGE_DEFAULTS.termMonths,
}) {
  if (!isFils(priceFils) || !isFils(downPaymentFils) || downPaymentFils > priceFils)
    throw invalid();
  if (!isBp(annualRateBp) || !Number.isInteger(termMonths)) throw invalid();
  if (termMonths < 1 || termMonths > MAX_TERM_MONTHS) throw invalid();
  const loanFils = priceFils - downPaymentFils;
  if (loanFils === 0) return { loanFils: 0, monthlyFils: 0, totalFils: 0, interestFils: 0 };
  const monthly = (value) => Math.floor(value + 0.5);
  if (annualRateBp === 0) {
    const monthlyFils = monthly(loanFils / termMonths);
    return { loanFils, monthlyFils, totalFils: loanFils, interestFils: 0 };
  }
  const monthlyRate = annualRateBp / 120_000;
  const factor = (1 + monthlyRate) ** termMonths;
  if (!Number.isFinite(factor)) throw invalid();
  const monthlyFils = monthly((loanFils * monthlyRate * factor) / (factor - 1));
  const totalFils = monthlyFils * termMonths;
  return { loanFils, monthlyFils, totalFils, interestFils: totalFils - loanFils };
}
