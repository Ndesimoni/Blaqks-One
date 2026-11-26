import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  agreementOn,
  calculate,
  outstanding,
  paymentVat,
  receivedShare,
  selectShare,
} from '../../src/lib/finance/commission.js';

const golden = JSON.parse(
  readFileSync(new URL('../fixtures/finance-golden.json', import.meta.url), 'utf8'),
);
const named = (columns, row) => Object.fromEntries(columns.split(' ').map((k, i) => [k, row[i]]));
const inputs = golden.inputs.map((row) => named(golden.inputColumns, row));

/** Builds the same terms as services/crm-api/src/finance/calc_tests.rs `terms`. */
function terms(input, teamDefault) {
  const fee =
    input.feeBasis === 'fixed'
      ? { basis: 'fixed', feeFils: input.fixedFeeFils }
      : { basis: 'percentage', agreedValueFils: input.agreedValueFils, rateBp: input.feeRateBp };
  const share = selectShare(input.ownerHeld, input.overrideBp, input.agreementBp, teamDefault);
  const built = {
    fee,
    partnerShareBp: input.partnerShareBp,
    agentShareBp: share.agentShareBp,
    secondShareBp: input.secondAgentShareBp,
    secondSource: input.secondAgentSource,
    vatRegistered: input.vatRegistered,
  };
  return { terms: built, share };
}

test('every golden G and E case matches the Rust engine exactly', () => {
  assert.equal(inputs.length, 15);
  golden.outputs.forEach((row, index) => {
    const want = named(golden.outputColumns, row);
    const input = inputs[index];
    assert.equal(input.id, want.id);
    const { terms: built, share } = terms(input, golden.teamDefaultBp);
    const got = calculate(built);
    assert.deepEqual(
      {
        id: input.id,
        splitSource: share.splitSource,
        agentShareBp: built.agentShareBp,
        ...got,
      },
      want,
      input.id,
    );
  });
});

test('golden payments: per-payment VAT, totals, received shares and outstanding', () => {
  assert.equal(golden.payments.length, 3);
  for (const row of golden.payments) {
    const want = named(golden.paymentColumns, row);
    const input = inputs.find((entry) => entry.id === want.deal);
    const { terms: built } = terms(input, 5000);
    const deal = calculate(built);
    const vat = want.paymentsFils.map((amount) => paymentVat(amount, built.vatRegistered));
    const received = want.paymentsFils.reduce((sum, amount) => sum + amount, 0);
    const share = (line) => (line === null ? null : receivedShare(line, received, deal.netFils));
    assert.deepEqual(
      {
        id: want.id,
        deal: want.deal,
        paymentsFils: want.paymentsFils,
        vatFils: vat,
        totalFils: want.paymentsFils.map((amount, i) => amount + vat[i]),
        receivedFils: received,
        primaryReceivedFils: share(deal.primaryFils),
        secondReceivedFils: share(deal.secondFils),
        outstandingFils: outstanding(deal.netFils, received),
      },
      want,
    );
  }
});

test('agreements apply from the inclusive start to the exclusive end', () => {
  const agreements = golden.agreements.map((row) => named(golden.agreementColumns, row));
  assert.equal(golden.agreementCases.length, 5);
  for (const [on, expected] of golden.agreementCases)
    assert.equal(agreementOn(agreements, on)?.id ?? null, expected, on);
});

test('out-of-range and non-integer inputs are refused without overflow, like the Rust engine', () => {
  const base = {
    fee: { basis: 'fixed', feeFils: 10_000_000_000_000 },
    partnerShareBp: 0,
    agentShareBp: 10_000,
    secondShareBp: 10_000,
    secondSource: 'company',
    vatRegistered: true,
  };
  assert.doesNotThrow(() => calculate(base));
  const fee = (feeFils) => ({ ...base, fee: { basis: 'fixed', feeFils } });
  for (const bad of [10_000_000_000_001, -1, 1.5, '100', 2 ** 53, null])
    assert.throws(() => calculate(fee(bad)), RangeError, String(bad));
  assert.throws(() => calculate({ ...base, partnerShareBp: 10_001 }), RangeError);
  assert.throws(() => calculate({ ...base, secondShareBp: -1 }), RangeError);
  assert.throws(() => calculate({ ...base, agentShareBp: 50.5 }), RangeError);
  assert.throws(() => calculate({ ...base, secondSource: 'partner' }), RangeError);
  assert.throws(() => calculate({ ...base, fee: { basis: 'other' } }), RangeError);
  assert.throws(() => paymentVat(Number.MAX_SAFE_INTEGER, true), RangeError);
  assert.equal(receivedShare(10, 5, 0), 0);
  assert.equal(receivedShare(10, Number.MAX_SAFE_INTEGER, 10), 10);
  assert.equal(receivedShare(10, -5, 10), 0);
  assert.equal(outstanding(10, 25), 0);
  assert.equal(outstanding(25, 10), 15);
});

test('a rate entered with a fixed basis is ignored and owner-held deals have no lines', () => {
  const fixed = calculate({
    fee: { basis: 'fixed', feeFils: 1_000, agreedValueFils: 9, rateBp: 10_000 },
    partnerShareBp: 0,
    agentShareBp: null,
    secondShareBp: 5_000,
    secondSource: 'first_agent',
    vatRegistered: false,
  });
  assert.deepEqual(fixed, {
    grossFils: 1_000,
    partnerFils: 0,
    netFils: 1_000,
    primaryFils: null,
    secondFils: null,
    companyFils: 1_000,
    vatFils: 0,
  });
});
