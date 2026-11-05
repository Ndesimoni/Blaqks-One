import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { dayOf, dubaiClock, dubaiMonth, dubaiToday, shiftDay } from '../../src/lib/dubaiDate.js';
import { adoptDubaiCalendar, dateShift, today } from '../../src/lib/dates.js';
import { effectiveRange, readFilters } from '../../src/features/server/activity/activityFilters.js';
import { dubaiDay, timeLabel } from '../../src/features/server/activity/activityModel.js';
import { defaultDateFilter } from '../../src/features/server/dateSearch/dateSearchModel.js';
import { earnDateLimits } from '../../src/features/server/finance/dealEstimate.js';
import {
  upcomingEntries,
  upcomingViewings,
} from '../../src/features/server/dashboard/upcomingModel.js';

// A computer in New York, at 21:30 UTC: still the 15th locally, already 01:30 on the 16th in Dubai.
process.env.TZ = 'America/New_York';
const NIGHT = Date.parse('2026-10-15T21:30:00.000Z');

function atClock(now, run) {
  mock.timers.enable({ apis: ['Date'], now });
  try {
    run();
  } finally {
    mock.timers.reset();
  }
}

test('the test computer really is on a different calendar day', () => {
  atClock(NIGHT, () => {
    assert.equal(new Date().getDate(), 15);
    assert.equal(new Date().getHours(), 17);
  });
});

test('today, this month and wall-clock times follow Asia/Dubai', () => {
  atClock(NIGHT, () => {
    assert.equal(dubaiToday(), '2026-10-16');
    assert.equal(dubaiMonth(), '2026-10');
    assert.equal(dubaiClock(new Date()), '01:30');
  });
  atClock(Date.parse('2026-10-31T20:30:00Z'), () => assert.equal(dubaiMonth(), '2026-11'));
  assert.equal(dubaiToday(NIGHT), '2026-10-16');
  assert.equal(dubaiToday('2026-10-15T19:59:59Z'), '2026-10-15');
  assert.equal(dubaiClock('2026-10-15T19:59:00Z'), '23:59');
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
  assert.equal(dayOf('2026-10-16 09:00'), '2026-10-16');
  assert.equal(dayOf('not a date'), '');
});

test('connected mode switches the shared today() to Dubai; the demo calendar stays local', () => {
  atClock(NIGHT, () => {
    assert.equal(today(), '2026-10-15');
    adoptDubaiCalendar();
    assert.equal(today(), '2026-10-16');
    assert.equal(dateShift(-1), '2026-10-15');
    assert.equal(dateShift(1), '2026-10-17');
  });
});

test('default ranges and limits start from the Dubai day', () => {
  atClock(NIGHT, () => {
    assert.deepEqual(defaultDateFilter(), { type: '', start: '2026-09-16', end: '2026-10-16' });
    assert.deepEqual(effectiveRange(readFilters('')), { from: '2026-07-19', to: '2026-10-16' });
    assert.equal(earnDateLimits({ manage: false }).max, '2026-10-16');
    assert.equal(earnDateLimits({ manage: false }).min, '2026-09-15');
  });
  assert.equal(dubaiDay('2026-10-15T21:30:00.000Z'), '2026-10-16');
  assert.equal(timeLabel('2026-10-15T21:30:00.000Z'), '01:30');
});

test('upcoming viewings start at the Dubai day, not the computer’s day', () => {
  const viewing = (id, when) => ({ viewing_id: id, appointment_date_time: when });
  const rows = [
    viewing('VW-3', '2026-10-17 10:00'),
    viewing('VW-1', '2026-10-15 23:00'),
    viewing('VW-2', '2026-10-16 00:30'),
  ];
  atClock(NIGHT, () => {
    assert.deepEqual(
      upcomingViewings(rows).map((row) => row.viewing_id),
      ['VW-2', 'VW-3'],
    );
    const held = [{ property_id: 'PR-1', appointment_date_time: '2026-10-15 22:00', agent: null }];
    assert.equal(upcomingEntries([], held, true).length, 0);
  });
});
