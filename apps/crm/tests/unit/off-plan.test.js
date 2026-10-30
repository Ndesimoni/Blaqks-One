import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_FILS } from '../../src/lib/finance/money.js';
import {
  MAX_MILESTONES,
  isIsoDate,
  offPlanSchedule,
  scheduleCsv,
} from '../../src/lib/finance/offPlan.js';

const aed = (value) => value * 100;
const milestone = (label, percentBp, date) => ({ label, percentBp, date });
const base = (overrides = {}) => ({
  priceFils: aed(1_000_000),
  milestones: [
    milestone('Booking', 1_000, '2026-11-01'),
    milestone('Construction', 4_000, '2027-06-01'),
    milestone('Handover', 5_000, '2028-01-01'),
  ],
  ...overrides,
});

test('milestones must total exactly 100% and amount to the price', () => {
  const schedule = offPlanSchedule(base());
  assert.deepEqual(
    schedule.milestones.map((row) => row.amountFils),
    [aed(100_000), aed(400_000), aed(500_000)],
  );
  assert.equal(schedule.totalFils, aed(1_000_000));
});

test('cumulative allocation keeps every fils exactly once', () => {
  const schedule = offPlanSchedule({
    priceFils: 100,
    milestones: [
      milestone('A', 3_333, '2026-11-01'),
      milestone('B', 3_333, '2026-11-02'),
      milestone('C', 3_334, '2026-11-03'),
    ],
  });
  assert.deepEqual(
    schedule.milestones.map((row) => row.amountFils),
    [33, 34, 33],
  );
  assert.equal(schedule.totalFils, 100);
  const single = offPlanSchedule({
    priceFils: 1,
    milestones: [milestone('A', 5_000, '2026-11-01'), milestone('B', 5_000, '2026-11-02')],
  });
  assert.deepEqual(
    single.milestones.map((row) => row.amountFils),
    [1, 0],
  );
});

test('a zero price produces a zero schedule and the maximum boundary stays exact', () => {
  const zero = offPlanSchedule(base({ priceFils: 0 }));
  assert.deepEqual(
    zero.milestones.map((row) => row.amountFils),
    [0, 0, 0],
  );
  assert.equal(zero.totalFils, 0);
  const max = offPlanSchedule(base({ priceFils: MAX_FILS }));
  assert.equal(max.totalFils, MAX_FILS);
});

test('invalid shares, dates, labels and counts are refused', () => {
  assert.throws(() => offPlanSchedule(base({ milestones: [] })), RangeError);
  assert.throws(
    () =>
      offPlanSchedule({
        priceFils: 100,
        milestones: Array.from({ length: MAX_MILESTONES + 1 }, (_, index) =>
          milestone(`M${index}`, index === 0 ? 10_000 : 0, '2026-11-01'),
        ),
      }),
    RangeError,
  );
  assert.throws(
    () => offPlanSchedule(base({ milestones: base().milestones.slice(0, 2) })),
    RangeError,
  );
  const tooMuch = base().milestones.map((row, index) => ({
    ...row,
    percentBp: index === 0 ? 1_100 : row.percentBp,
  }));
  assert.throws(() => offPlanSchedule(base({ milestones: tooMuch })), RangeError);
  assert.throws(
    () => offPlanSchedule({ priceFils: 100, milestones: [milestone(' ', 10_000, '2026-11-01')] }),
    RangeError,
  );
  assert.throws(
    () => offPlanSchedule({ priceFils: 100, milestones: [milestone('A', 10_000, '2025-02-29')] }),
    RangeError,
  );
  assert.throws(
    () =>
      offPlanSchedule({
        priceFils: 100,
        milestones: [milestone('A', 5_000, '2026-11-02'), milestone('B', 5_000, '2026-11-01')],
      }),
    RangeError,
  );
  for (const priceFils of [-1, 1.5, MAX_FILS + 1, '100', null]) {
    assert.throws(() => offPlanSchedule(base({ priceFils })), RangeError, String(priceFils));
  }
});

test('dates and CSV export are readable', () => {
  assert.equal(isIsoDate('2024-02-29'), true);
  assert.equal(isIsoDate('2025-02-29'), false);
  assert.equal(isIsoDate('2026-11-1'), false);
  const csv = scheduleCsv(offPlanSchedule(base()).milestones);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"Milestone","Date","Share %","Amount (AED)"');
  assert.equal(lines[1], '"Booking","2026-11-01","10","100000.00"');
  assert.equal(lines.at(-1), '"Total","","100","1000000.00"');
});

test('CSV export translates the total row and keeps formula-like labels inert', () => {
  const milestones = offPlanSchedule(base()).milestones.map((milestone, index) =>
    index === 0 ? { ...milestone, label: '=HYPERLINK("x")' } : milestone,
  );
  const lines = scheduleCsv(milestones, ['م', 'ت', 'ن', 'م'], 'الإجمالي').split('\n');
  assert.equal(lines[1].split(',')[0], `"'=HYPERLINK(""x"")"`);
  assert.equal(lines.at(-1), '"الإجمالي","","100","1000000.00"');
});
