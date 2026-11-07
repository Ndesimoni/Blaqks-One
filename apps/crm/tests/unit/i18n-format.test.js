import test from 'node:test';
import assert from 'node:assert/strict';
import { createFormatters } from '../../src/i18n/format.js';
import { formatAed, formatPercent } from '../../src/lib/finance/money.js';

const en = createFormatters('en');
const ar = createFormatters('ar');
const strip = (text) => text.replace(/[\u200e\u200f\u061c]/g, '').replace(/[\u00a0\u202f]/g, ' ');

test('English money and percentages are exactly the existing helpers', () => {
  for (const fils of [0, 1, 245_000_050, 10_000_000_000_000])
    assert.equal(en.money(fils), formatAed(fils));
  for (const bp of [0, 1250, 6000, 10_000]) assert.equal(en.percent(bp), formatPercent(bp));
  assert.equal(en.money(null), '—');
  assert.equal(en.percent(undefined), '—');
});

test('Arabic money keeps exact fils with Western digits', () => {
  assert.equal(strip(ar.money(245_000_050)), '2,450,000.50 د.إ.');
  assert.equal(strip(ar.money(10_000_000_000_000)), '100,000,000,000.00 د.إ.');
  assert.equal(strip(ar.money(1)), '0.01 د.إ.');
  assert.equal(strip(ar.money(9_007_199_254_740_993n)), '90,071,992,547,409.93 د.إ.');
  assert.equal(ar.money(12.5), '—');
  assert.doesNotMatch(ar.money(123_456), /[٠-٩]/);
});

test('Arabic percentages and numbers use Western digits', () => {
  assert.equal(strip(ar.percent(1250)), '12.5%');
  assert.equal(strip(ar.percent(1)), '0.01%');
  assert.equal(ar.number(1_234_567), '1,234,567');
  assert.equal(en.number(1_234_567), '1,234,567');
  assert.equal(en.number('12'), '—');
});

test('dates and times follow Asia/Dubai in both languages', () => {
  const late = '2026-10-16T21:30:00Z'; // 01:30 on 17 October in Dubai.
  assert.equal(en.date(late), '17 Oct 2026');
  assert.equal(en.time(late), '01:30');
  assert.equal(en.date('2026-10-16'), '16 Oct 2026');
  assert.match(ar.date('2026-10-16'), /16/);
  assert.match(ar.date('2026-10-16'), /2026/);
  assert.doesNotMatch(ar.dateTime(late), /[٠-٩]/);
  assert.equal(strip(ar.time(late)), '01:30');
  assert.equal(en.date('not a date'), '—');
  assert.equal(ar.date(null), '—');
});
