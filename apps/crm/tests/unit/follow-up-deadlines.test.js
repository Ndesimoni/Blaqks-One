import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deadlineGroup,
  deadlineMoment,
  deadlineWhen,
  groupDeadlines,
  isOverdueDeadline,
  orderDeadlines,
} from '../../src/features/server/followUps/deadlineModel.js';
import { dubaiToday } from '../../src/lib/dubaiDate.js';

const now = '2026-11-01';
const task = (id, due, status = 'Open') => ({
  activity_id: id,
  due_date: due,
  task_status: status,
});

test('deadline calendar validates real dates and UAE wall-clock time without local-zone parsing', () => {
  assert.deepEqual(deadlineMoment('2024-02-29'), { day: '2024-02-29', time: '' });
  assert.deepEqual(deadlineMoment('2026-11-01 23:59'), { day: now, time: '23:59' });
  assert.deepEqual(deadlineMoment('2026-11-01T00:01:30'), { day: now, time: '00:01' });
  for (const value of [
    '',
    null,
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-11-01junk',
    '2026-11-01 24:00',
    '2026-11-01 12:60',
    '11/01/2026',
  ]) {
    assert.deepEqual(deadlineMoment(value), { day: '', time: '' }, String(value));
  }
});

test('deadline groups use the Dubai business day and keep terminal tasks out of overdue', () => {
  const day = dubaiToday('2026-10-31T20:05:00Z');
  assert.equal(day, now);
  assert.equal(deadlineGroup(task('A', '2026-10-31'), day), 'overdue');
  assert.equal(deadlineGroup(task('A', now), day), 'today');
  assert.equal(isOverdueDeadline(task('A', now), day), false);
  assert.equal(isOverdueDeadline(task('A', '2026-10-31'), day), true);
  assert.equal(isOverdueDeadline(task('A', '2026-10-31', 'Completed'), day), false);
  // The mockup's This week runs to Sunday; 1 November 2026 is a Sunday, so Monday is Later.
  assert.equal(deadlineGroup(task('A', '2026-11-02'), day), 'later');
  const monday = '2026-11-02';
  assert.equal(deadlineGroup(task('A', '2026-11-08'), monday), 'week');
  assert.equal(deadlineGroup(task('A', '2026-11-09'), monday), 'later');
  assert.deepEqual(deadlineWhen(task('A', '2026-11-02 10:30'), monday), {
    kind: 'time',
    time: '10:30',
  });
  assert.equal(deadlineWhen(task('A', '2026-11-01'), monday).kind, 'yesterday');
  assert.equal(deadlineWhen(task('A', '2026-11-05'), monday).kind, 'weekday');
  assert.equal(deadlineWhen(task('A', '2026-10-20'), monday).kind, 'date');
  assert.equal(deadlineWhen(task('A', ''), monday).kind, 'none');
  assert.equal(deadlineGroup(task('A', '2026-02-30'), day), 'undated');
  for (const status of ['Completed', 'Cancelled', 'Closed', 'Done']) {
    assert.equal(deadlineGroup(task('A', '2020-01-01', status), day), 'closed');
  }
});

test('deadline ordering is stable, prioritises open dates and leaves stored records untouched', () => {
  const records = [
    task('U', ''),
    task('C0', '', 'Cancelled'),
    task('C1', '2026-10-01', 'Completed'),
    task('T2', now),
    task('O2', '2026-10-31'),
    task('F', '2026-11-02'),
    task('T1', now),
    task('O1', '2026-10-01'),
    task('C2', now, 'Completed'),
  ];
  const snapshot = structuredClone(records);
  for (const record of records) Object.freeze(record);
  Object.freeze(records);
  assert.deepEqual(
    orderDeadlines(records, now).map((record) => record.activity_id),
    ['O1', 'O2', 'T1', 'T2', 'F', 'U', 'C2', 'C1', 'C0'],
  );
  assert.deepEqual(records, snapshot);
  assert.equal(records[1].task_status, 'Cancelled');
});

test('deadline times order within a day, unknown dates remain visible and grouping preserves every task', () => {
  const records = [task('B', `${now} 14:00`), task('A', `${now} 09:00`), task('I', 'invalid')];
  const groups = groupDeadlines(orderDeadlines(records, now), now);
  assert.deepEqual(
    groups.map(({ key }) => key),
    ['today', 'undated'],
  );
  assert.deepEqual(
    groups.flatMap(({ records }) => records).map((record) => record.activity_id),
    ['A', 'B', 'I'],
  );
  assert.deepEqual(groupDeadlines([], now), []);
  assert.equal(orderDeadlines([records[0], { ...records[0] }], now)[0], records[0]);
});
