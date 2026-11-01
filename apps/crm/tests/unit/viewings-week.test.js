import assert from 'node:assert/strict';
import test from 'node:test';
import { dubaiToday } from '../../src/lib/dubaiDate.js';
import {
  bandOf,
  matchesViewingTab,
  orderViewings,
  selectViewingWeek,
  viewingMoment,
  weekBands,
  weekDays,
  weekStart,
} from '../../src/features/server/viewings/weekModel.js';

const viewing = (id, at, status = 'Scheduled') => ({
  viewing_id: id,
  appointment_date_time: at,
  viewing_status: status,
});

test('viewing dates validate the calendar and do not invent times for date-only records', () => {
  assert.deepEqual(viewingMoment('2024-02-29'), { day: '2024-02-29', time: '' });
  assert.deepEqual(viewingMoment('2026-11-01 23:59:58'), { day: '2026-11-01', time: '23:59' });
  assert.deepEqual(viewingMoment('2026-11-01T00:00'), { day: '2026-11-01', time: '00:00' });
  for (const value of [
    '',
    null,
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-01-00',
    '2026-11-01 24:00',
    '2026-11-01 10:60',
    '2026-11-01junk',
    '01/11/2026',
  ])
    assert.deepEqual(viewingMoment(value), { day: '', time: '' }, String(value));
});

test('weeks begin Monday across Sunday, leap day, month and year boundaries', () => {
  assert.equal(weekStart('2026-11-01'), '2026-10-26');
  assert.equal(weekStart('2026-11-02'), '2026-11-02');
  assert.equal(weekStart('2027-01-01'), '2026-12-28');
  assert.deepEqual(weekDays(weekStart('2024-02-29')), [
    '2024-02-26',
    '2024-02-27',
    '2024-02-28',
    '2024-02-29',
    '2024-03-01',
    '2024-03-02',
    '2024-03-03',
  ]);
  assert.equal(weekStart('invalid'), '');
  assert.deepEqual(weekDays('invalid'), []);
});

test('Dubai midnight determines the week independently of the computer timezone', () => {
  const sunday = dubaiToday('2026-11-01T19:59:00Z');
  const monday = dubaiToday('2026-11-01T20:00:00Z');
  assert.equal(weekStart(sunday), '2026-10-26');
  assert.equal(weekStart(monday), '2026-11-02');
  assert.equal(matchesViewingTab(viewing('A', '2026-11-02 00:01'), 'Upcoming', monday), true);
  assert.equal(matchesViewingTab(viewing('B', sunday), 'Upcoming', monday), false);
  assert.equal(matchesViewingTab(viewing('C', 'invalid'), 'Upcoming', monday), false);
  assert.equal(matchesViewingTab(viewing('D', sunday, 'Completed'), 'Completed', monday), true);
  assert.equal(matchesViewingTab(viewing('E', monday, 'Cancelled'), 'Completed', monday), false);
});

test('week selection keeps every dated appointment only in its own week and invalid dates unscheduled', () => {
  const records = [
    viewing('NEXT', '2026-11-09 10:00'),
    viewing('MON', '2026-11-02 10:00'),
    viewing('SUN', '2026-11-08 23:59'),
    viewing('OLD', '2026-11-01 23:59'),
    viewing('NONE', ''),
    viewing('BAD', '2026-02-30'),
  ];
  const result = selectViewingWeek(records, '2026-11-02');
  assert.equal(result.count, 2);
  assert.equal(result.outsideCount, 2);
  assert.equal(result.count + result.outsideCount + result.unscheduled.length, records.length);
  assert.equal(result.days.length, 7);
  assert.deepEqual(
    result.days.flatMap(({ records }) => records).map((row) => row.viewing_id),
    ['MON', 'SUN'],
  );
  assert.deepEqual(
    result.unscheduled.map((row) => row.viewing_id),
    ['BAD', 'NONE'],
  );
  assert.equal(selectViewingWeek(records, '2026-11-09').count, 1);
});

test('ordering is stable and immutable, with known times before date-only viewings', () => {
  const records = [
    viewing('DATE', '2026-11-02'),
    viewing('B', '2026-11-02 10:00'),
    viewing('A', '2026-11-02 10:00'),
    viewing('EARLY', '2026-11-02 09:00'),
  ];
  const snapshot = structuredClone(records);
  records.forEach(Object.freeze);
  Object.freeze(records);
  assert.deepEqual(
    orderViewings(records).map((row) => row.viewing_id),
    ['EARLY', 'A', 'B', 'DATE'],
  );
  assert.deepEqual(records, snapshot);
  assert.equal(selectViewingWeek([], '2026-11-02').count, 0);
  assert.deepEqual(selectViewingWeek([], '2026-11-02').unscheduled, []);
});

test("the mockup's two-hour rows run 08:00 to 18:00 and widen to fit the week", () => {
  assert.equal(bandOf('09:00'), 8);
  assert.equal(bandOf('10:30'), 10);
  const week = (times) => [{ records: times.map((at, i) => viewing(`V${i}`, at)) }];
  assert.deepEqual(weekBands(week([])), [8, 10, 12, 14, 16, 18]);
  assert.deepEqual(
    weekBands(week(['2026-11-02 07:15', '2026-11-02 21:00'])),
    [6, 8, 10, 12, 14, 16, 18, 20],
  );
  assert.deepEqual(weekBands(week(['2026-11-02'])), [8, 10, 12, 14, 16, 18], 'no time, no row');
});
