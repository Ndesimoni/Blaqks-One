import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_FILS,
  amountMessage,
  bpToPercent,
  filsToAed,
  formatAed,
  formatFils,
  formatPercent,
  parseAed,
  parsePercent,
  percentMessage,
  rangeMessage,
  shareOfBp,
} from '../../src/lib/finance/money.js';

const ok = (value) => ({ value, error: '' });
const refused = (error) => ({ value: null, error });

test('AED text parses to exact fils with grouping, an AED prefix and up to two decimals', () => {
  assert.deepEqual(parseAed('2,450,000.5'), ok(245_000_050));
  assert.deepEqual(parseAed('2450000.50'), ok(245_000_050));
  assert.deepEqual(parseAed('  AED 1,000  '), ok(100_000));
  assert.deepEqual(parseAed('aed12.34'), ok(1_234));
  assert.deepEqual(parseAed('0'), ok(0));
  assert.deepEqual(parseAed('0.01'), ok(1));
  assert.deepEqual(parseAed('1.1'), ok(110));
  assert.deepEqual(parseAed('007'), ok(700));
  // 0.1 + 0.2 style float drift never appears: digits are summed as integers.
  assert.deepEqual(parseAed('0.29'), ok(29));
  assert.deepEqual(parseAed('1,234,567,890.99'), ok(123_456_789_099));
  assert.deepEqual(parseAed(''), ok(null));
  assert.deepEqual(parseAed('   '), ok(null));
});

test('AED text is refused, never rounded, for extra decimals, negatives and bad separators', () => {
  for (const text of ['1.005', '0.001', '12.345', '-5', '-0.01', '+5', '1e3', '0x10', 'abc'])
    assert.deepEqual(parseAed(text), refused(amountMessage), text);
  for (const text of ['1,00', '12,34,567', ',100', '1 000', '1.000.00', '12.', '.5', '١٢'])
    assert.deepEqual(parseAed(text), refused(amountMessage), text);
  for (const value of [12.5, 100, null, undefined, 10n])
    assert.deepEqual(parseAed(value), refused(amountMessage), String(value));
});

test('huge AED values stop at the AED 100bn storage cap without precision loss', () => {
  assert.deepEqual(parseAed('100,000,000,000'), ok(MAX_FILS));
  assert.deepEqual(parseAed('100000000000.00'), ok(MAX_FILS));
  assert.deepEqual(parseAed('100000000000.01'), refused(rangeMessage));
  assert.deepEqual(parseAed('90071992547409.93'), refused(rangeMessage));
  assert.deepEqual(parseAed('9'.repeat(40)), refused(rangeMessage));
});

test('fils format to exact AED text and round-trip through parsing', () => {
  assert.equal(filsToAed(245_000_050), '2450000.50');
  assert.equal(filsToAed(0), '0.00');
  assert.equal(filsToAed(7), '0.07');
  assert.equal(filsToAed(-150), '-1.50');
  assert.equal(filsToAed(MAX_FILS), '100000000000.00');
  assert.equal(filsToAed(2n ** 70n), '11805916207174113034.24');
  assert.equal(formatFils(245_000_050), '2,450,000.50');
  assert.equal(formatFils(-123_456_789), '-1,234,567.89');
  assert.equal(formatFils(99), '0.99');
  assert.equal(formatAed(436_667), 'AED 4,366.67');
  assert.equal(formatAed(null), '—');
  for (const bad of [1.5, '100', 2 ** 53, Number.NaN, Infinity])
    assert.throws(() => filsToAed(bad), TypeError, String(bad));
  for (const fils of [0, 1, 99, 100, 101, 245_000_050, MAX_FILS - 1, MAX_FILS])
    assert.deepEqual(parseAed(filsToAed(fils)), ok(fils));
  assert.deepEqual(parseAed(formatFils(123_456_789_012)), ok(123_456_789_012));
});

test('percentages convert to basis points with at most two decimals and at most 100%', () => {
  assert.deepEqual(parsePercent('60'), ok(6_000));
  assert.deepEqual(parsePercent('12.5%'), ok(1_250));
  assert.deepEqual(parsePercent(' 0.01 '), ok(1));
  assert.deepEqual(parsePercent('100.00'), ok(10_000));
  assert.deepEqual(parsePercent('0'), ok(0));
  assert.deepEqual(parsePercent(''), ok(null));
  for (const text of ['100.01', '101', '12.345', '-1', '1,000', 'abc', '5.', '000000001'])
    assert.deepEqual(parsePercent(text), refused(percentMessage), text);
  assert.deepEqual(parsePercent(60), refused(percentMessage));
  assert.equal(bpToPercent(1_250), '12.5');
  assert.equal(bpToPercent(6_000), '60');
  assert.equal(bpToPercent(1), '0.01');
  assert.equal(bpToPercent(10_000), '100');
  assert.equal(formatPercent(2_575), '25.75%');
  assert.equal(formatPercent(undefined), '—');
  assert.throws(() => bpToPercent(10_001), TypeError);
  assert.throws(() => bpToPercent(12.5), TypeError);
  for (let bp = 0; bp <= 10_000; bp += 7) assert.deepEqual(parsePercent(bpToPercent(bp)), ok(bp));
});

test('share of net rounds half-up in basis points for the workbook "Your share %"', () => {
  assert.equal(shareOfBp(2_940_000, 4_900_000), 6_000);
  assert.equal(shareOfBp(1, 3), 3_333);
  assert.equal(shareOfBp(2, 3), 6_667);
  assert.equal(shareOfBp(1, 20_000), 1);
  assert.equal(shareOfBp(1, 20_001), 0);
  assert.equal(shareOfBp(5, 0), 0);
  assert.equal(shareOfBp(0, 5), 0);
  assert.equal(shareOfBp(MAX_FILS, MAX_FILS), 10_000);
});

test('money and commission sources contain no floating-point paths', () => {
  for (const file of ['money.js', 'commission.js', 'preview.js']) {
    const url = new URL(`../../src/lib/finance/${file}`, import.meta.url);
    const source = readFileSync(url, 'utf8');
    for (const pattern of [/parseFloat/, /toFixed/, /Math\.(round|floor|ceil)/, /\/ ?100\b(?!n)/])
      assert.doesNotMatch(source, pattern, `${file} ${pattern}`);
  }
});
