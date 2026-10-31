import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_FILS } from '../../src/lib/finance/money.js';
import { yieldSummary } from '../../src/lib/finance/yield.js';

const aed = (value) => value * 100;
const base = {
  propertyValueFils: aed(1_000_000),
  annualRentFils: aed(80_000),
  annualCostsFils: aed(20_000),
  cashInvestedFils: aed(250_000),
};

test('gross yield, net yield and ROI are reported separately', () => {
  assert.deepEqual(yieldSummary(base), {
    netIncomeFils: aed(60_000),
    grossYieldBp: 800,
    netYieldBp: 600,
    roiBp: 2_400,
  });
});

test('a zero property value or zero cash leaves that percentage blank', () => {
  const noValue = yieldSummary({ ...base, propertyValueFils: 0 });
  assert.equal(noValue.grossYieldBp, null);
  assert.equal(noValue.netYieldBp, null);
  assert.equal(noValue.roiBp, 2_400);
  const noCash = yieldSummary({ ...base, cashInvestedFils: 0 });
  assert.equal(noCash.roiBp, null);
  assert.equal(noCash.grossYieldBp, 800);
});

test('negative net income is reported, not hidden', () => {
  const loss = yieldSummary({
    ...base,
    annualRentFils: aed(10_000),
    annualCostsFils: aed(30_000),
  });
  assert.equal(loss.netIncomeFils, aed(-20_000));
  assert.equal(loss.netYieldBp, -200);
  assert.equal(loss.roiBp, -800);
});

test('percentages round half-up to one basis point', () => {
  const third = yieldSummary({
    propertyValueFils: 3,
    annualRentFils: 1,
    annualCostsFils: 0,
    cashInvestedFils: 3,
  });
  assert.equal(third.grossYieldBp, 3_333);
  assert.equal(third.netYieldBp, 3_333);
  assert.equal(third.roiBp, 3_333);
});

test('maximum values stay safe and zero cases produce zeroes', () => {
  const max = yieldSummary({
    propertyValueFils: MAX_FILS,
    annualRentFils: MAX_FILS,
    annualCostsFils: 0,
    cashInvestedFils: MAX_FILS,
  });
  assert.equal(max.grossYieldBp, 10_000);
  assert.equal(max.roiBp, 10_000);
  assert.deepEqual(
    yieldSummary({
      propertyValueFils: 0,
      annualRentFils: 0,
      annualCostsFils: 0,
      cashInvestedFils: 0,
    }),
    { netIncomeFils: 0, grossYieldBp: null, netYieldBp: null, roiBp: null },
  );
});

test('invalid amounts are refused', () => {
  for (const key of [
    'propertyValueFils',
    'annualRentFils',
    'annualCostsFils',
    'cashInvestedFils',
  ]) {
    for (const value of [-1, 1.5, MAX_FILS + 1, '100', null]) {
      assert.throws(() => yieldSummary({ ...base, [key]: value }), RangeError, `${key}=${value}`);
    }
  }
});
