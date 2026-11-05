import assert from 'node:assert/strict';
import test from 'node:test';
import { COST_DEFAULTS, purchaseCosts } from '../../src/lib/finance/calculators.js';
import { MAX_FILS } from '../../src/lib/finance/money.js';

const aed = (value) => value * 100;

test('approved defaults price DLD, agency and VAT in whole fils', () => {
  assert.deepEqual(COST_DEFAULTS, { dldBp: 400, agencyBp: 200, vatBp: 500 });
  assert.deepEqual(purchaseCosts({ priceFils: aed(2_450_000) }), {
    dldFils: aed(98_000),
    agencyFils: aed(49_000),
    vatFils: aed(2_450),
    totalFils: aed(149_450),
  });
});

test('a zero price stays zero and zero rates remove each cost', () => {
  assert.deepEqual(purchaseCosts({ priceFils: 0 }), {
    dldFils: 0,
    agencyFils: 0,
    vatFils: 0,
    totalFils: 0,
  });
  assert.deepEqual(purchaseCosts({ priceFils: aed(100), dldBp: 0, agencyBp: 0, vatBp: 0 }), {
    dldFils: 0,
    agencyFils: 0,
    vatFils: 0,
    totalFils: 0,
  });
});

test('fractional fils round half-up once per line', () => {
  assert.deepEqual(purchaseCosts({ priceFils: 12_345, dldBp: 400, agencyBp: 200, vatBp: 500 }), {
    dldFils: 494,
    agencyFils: 247,
    vatFils: 12,
    totalFils: 753,
  });
  assert.equal(purchaseCosts({ priceFils: 1, dldBp: 5_000 }).dldFils, 1);
});

test('editable rates run to 100% without overflow', () => {
  const max = purchaseCosts({
    priceFils: MAX_FILS,
    dldBp: 10_000,
    agencyBp: 10_000,
    vatBp: 10_000,
  });
  assert.equal(max.dldFils, MAX_FILS);
  assert.equal(max.agencyFils, MAX_FILS);
  assert.equal(max.vatFils, MAX_FILS);
  assert.equal(max.totalFils, MAX_FILS * 3);
});

test('invalid price and rate inputs are refused', () => {
  for (const priceFils of [-1, 1.5, MAX_FILS + 1, '100', null, undefined]) {
    assert.throws(() => purchaseCosts({ priceFils }), RangeError, String(priceFils));
  }
  for (const dldBp of [-1, 10_001, 4.5, '400', null]) {
    assert.throws(() => purchaseCosts({ priceFils: 100, dldBp }), RangeError, String(dldBp));
  }
  assert.throws(() => purchaseCosts({ priceFils: 100, agencyBp: 10_001 }), RangeError);
  assert.throws(() => purchaseCosts({ priceFils: 100, vatBp: -1 }), RangeError);
});
