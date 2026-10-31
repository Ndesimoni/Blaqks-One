import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calculate,
  outstanding,
  receivedShare,
  selectShare,
} from '../../src/lib/finance/commission.js';

const golden = JSON.parse(
  readFileSync(new URL('../fixtures/finance-golden.json', import.meta.url), 'utf8'),
);
const MASK = (1n << 64n) - 1n;

/** splitmix64 with wrapping u64 arithmetic, as in calc_property_tests.rs. */
function splitMix64(seed) {
  let state = BigInt(seed);
  const next = () => {
    state = (state + 0x9e3779b97f4a7c15n) & MASK;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
    return z ^ (z >> 31n);
  };
  return { below: (bound) => Number(next() % BigInt(bound)) };
}

/** The fixture's documented draw order (property.draws). */
function draw(random) {
  const money = 10_000_000_000_001;
  const fixed = random.below(2) === 1;
  const agreed = random.below(money);
  const rate = random.below(10_001);
  const fixedFee = random.below(money);
  const partner = random.below(10_001);
  const ownerHeld = random.below(4) === 0;
  const agreement = random.below(10_001);
  const hasSecond = random.below(2) === 1;
  const second = random.below(10_001);
  const company = random.below(2) === 1;
  const vat = random.below(2) === 1;
  const { agentShareBp } = selectShare(ownerHeld, null, agreement, 0);
  const terms = {
    fee: fixed
      ? { basis: 'fixed', feeFils: fixedFee }
      : { basis: 'percentage', agreedValueFils: agreed, rateBp: rate },
    partnerShareBp: partner,
    agentShareBp,
    secondShareBp: hasSecond ? second : null,
    secondSource: company ? 'company' : 'first_agent',
    vatRegistered: vat,
  };
  return { terms, share: agentShareBp };
}

test('10k splitmix64 cases keep every invariant and reproduce the Rust column sums', () => {
  const { property } = golden;
  assert.equal(property.generator, 'splitmix64');
  assert.equal(property.seed, 20261014);
  const random = splitMix64(property.seed);
  const sums = Object.fromEntries(Object.keys(property.sums).map((key) => [key, 0n]));
  const add = (key, value) => (sums[key] += BigInt(value));
  for (let index = 0; index < property.cases; index += 1) {
    const { terms, share } = draw(random);
    const result = calculate(terms);
    assert.deepEqual(calculate(terms), result, 'deterministic');
    const lines = (result.primaryFils ?? 0) + (result.secondFils ?? 0);
    assert.equal(
      BigInt(result.grossFils),
      BigInt(result.partnerFils) + BigInt(result.companyFils) + BigInt(lines),
    );
    for (const value of Object.values(result)) assert.ok(value === null || value >= 0);
    assert.equal(result.primaryFils !== null, share !== null);
    const received = random.below(2 * result.netFils + 1);
    const shareOf = (line) => (line === null ? 0 : receivedShare(line, received, result.netFils));
    const [primary, second] = [shareOf(result.primaryFils), shareOf(result.secondFils)];
    assert.ok(primary + second <= Math.min(received, result.netFils));
    add('agentShareBp', share ?? 0);
    for (const key of ['grossFils', 'partnerFils', 'netFils', 'companyFils', 'vatFils'])
      add(key, result[key]);
    add('primaryFils', result.primaryFils ?? 0);
    add('secondFils', result.secondFils ?? 0);
    add('receivedFils', received);
    add('primaryReceivedFils', primary);
    add('secondReceivedFils', second);
    add('outstandingFils', outstanding(result.netFils, received));
  }
  for (const [key, want] of Object.entries(property.sums))
    assert.equal(String(sums[key]), want, key);
});
