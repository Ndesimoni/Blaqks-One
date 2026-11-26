import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_FILS } from '../../src/lib/finance/money.js';
import {
  MAX_TERM_MONTHS,
  MORTGAGE_DEFAULTS,
  mortgageRepayment,
} from '../../src/lib/finance/mortgage.js';

const aed = (value) => value * 100;

test('the standard annuity case rounds the monthly payment to the fils', () => {
  assert.deepEqual(
    mortgageRepayment({
      priceFils: aed(1_000_000),
      downPaymentFils: aed(200_000),
      annualRateBp: 500,
      termMonths: 300,
    }),
    {
      loanFils: aed(800_000),
      monthlyFils: 467_672,
      totalFils: 140_301_600,
      interestFils: 60_301_600,
    },
  );
  assert.deepEqual(MORTGAGE_DEFAULTS, { annualRateBp: 400, termMonths: 300 });
});

test('a zero-rate loan repays exactly its principal', () => {
  assert.deepEqual(
    mortgageRepayment({
      priceFils: aed(1_000_000),
      downPaymentFils: aed(200_000),
      annualRateBp: 0,
      termMonths: 240,
    }),
    {
      loanFils: aed(800_000),
      monthlyFils: 333_333,
      totalFils: aed(800_000),
      interestFils: 0,
    },
  );
  // Half-up: six fils over twelve months is one fils a month.
  assert.equal(mortgageRepayment({ priceFils: 6, annualRateBp: 0, termMonths: 12 }).monthlyFils, 1);
});

test('a full down payment or zero price needs no repayment', () => {
  const none = { loanFils: 0, monthlyFils: 0, totalFils: 0, interestFils: 0 };
  assert.deepEqual(
    mortgageRepayment({ priceFils: aed(500_000), downPaymentFils: aed(500_000) }),
    none,
  );
  assert.deepEqual(mortgageRepayment({ priceFils: 0 }), none);
});

test('invalid amounts, rates and terms are refused', () => {
  const base = { priceFils: aed(1_000_000), downPaymentFils: aed(200_000), termMonths: 300 };
  for (const priceFils of [-1, 1.5, MAX_FILS + 1, '100', null]) {
    assert.throws(() => mortgageRepayment({ ...base, priceFils }), RangeError, String(priceFils));
  }
  assert.throws(() => mortgageRepayment({ ...base, downPaymentFils: aed(1_000_001) }), RangeError);
  for (const annualRateBp of [-1, 10_001, 4.5, '400', null]) {
    assert.throws(
      () => mortgageRepayment({ ...base, annualRateBp }),
      RangeError,
      String(annualRateBp),
    );
  }
  for (const termMonths of [0, -1, 1.5, MAX_TERM_MONTHS + 1, '300', null]) {
    assert.throws(() => mortgageRepayment({ ...base, termMonths }), RangeError, String(termMonths));
  }
});

test('the 50-year, 100% boundary stays finite', () => {
  const result = mortgageRepayment({
    priceFils: MAX_FILS,
    annualRateBp: 10_000,
    termMonths: MAX_TERM_MONTHS,
  });
  assert.ok(Number.isSafeInteger(result.monthlyFils));
  assert.ok(result.totalFils >= result.loanFils);
});
