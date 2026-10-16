import test from 'node:test';
import assert from 'node:assert/strict';
import {
  minutesOf,
  nowPercent,
  startPercent,
  todayTimeline,
} from '../../src/features/server/dashboard/timelineModel.js';

const today = '2026-10-16';

test('times are read from stored Dubai wall-clock text', () => {
  assert.equal(minutesOf('2026-10-16 14:30'), 870);
  assert.equal(minutesOf('2026-10-16T09:05'), 545);
  assert.equal(minutesOf('2026-10-16'), null);
  assert.equal(minutesOf(''), null);
});

test('positions stay inside the 09:00–19:00 window; now shows only within it', () => {
  assert.equal(startPercent(540), 0);
  assert.equal(startPercent(840), 50);
  assert.equal(startPercent(1200), 90);
  assert.equal(startPercent(400), 0);
  assert.equal(nowPercent(860), 53.3);
  assert.equal(nowPercent(500), null);
  assert.equal(nowPercent(null), null);
});

test('today’s timeline keeps only today, sorts by time and separates untimed follow-ups', () => {
  const viewings = [
    { kind: 'own', at: '2026-10-16 15:00', record: { viewing_id: 'VW-1' } },
    { kind: 'held', at: '2026-10-16 10:00', propertyId: 'PR-1', agentName: 'Two' },
    { kind: 'own', at: '2026-10-17 09:00', record: { viewing_id: 'VW-2' } },
    { kind: 'own', at: '2026-10-16', record: { viewing_id: 'VW-3' } },
  ];
  const dueTasks = [
    { activity_id: 'FU-1', due_date: '2026-10-16' },
    { activity_id: 'FU-2', due_date: '2026-10-16 12:30' },
    { activity_id: 'FU-3', due_date: '2026-10-01' },
  ];
  const { timed, untimed } = todayTimeline({ viewings, dueTasks, today });
  assert.deepEqual(
    timed.map((item) => [item.kind, item.time]),
    [
      ['held', '10:00'],
      ['follow-up', '12:30'],
      ['viewing', '15:00'],
    ],
  );
  assert.deepEqual(
    untimed.map((task) => task.activity_id),
    ['FU-1'],
  );
});
