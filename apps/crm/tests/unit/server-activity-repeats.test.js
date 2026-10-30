import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupRepeats,
  repeatCount,
  repeatKey,
} from '../../src/features/server/activity/activityGrouping.js';
import { groupByDay, timeLabel } from '../../src/features/server/activity/activityModel.js';

const ME = { id: '00000000-0000-4000-8000-000000000001', name: 'Me' };
const LAYLA = { id: '00000000-0000-4000-8000-000000000002', name: 'Layla Synthetic' };
let serial = 0;
/** One entry `minutes` after 06:00 Dubai (02:00 UTC) on 16 October 2026. */
const entry = (minutes, changes = {}) => ({
  id: `a${(serial += 1)}`,
  at: new Date(Date.parse('2026-10-16T02:00:00Z') + minutes * 60_000).toISOString(),
  kind: 'record',
  action: 'updated',
  collection: 'Clients',
  actor: ME,
  record: { id: 'r1', legacyId: 'CL-001' },
  member: null,
  sample: false,
  ...changes,
});
const shape = (rows) => rows.map((row) => row.items.map((item) => item.id));

test('consecutive edits of one record by one person collapse, newest first', () => {
  const items = [21, 20, 19, 18, 17, 16, 15].map((minute) => entry(minute));
  const rows = groupRepeats(items);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, items[0].id);
  assert.equal(rows[0].item, items[0]);
  assert.equal(repeatCount(rows[0].items.length), '7 times');
  assert.equal(timeLabel(rows[0].items.at(-1).at), '06:15');
  assert.equal(timeLabel(rows[0].items[0].at), '06:21');
});

test('a different actor, action, record or a gap over 10 minutes starts a new row', () => {
  const items = [
    entry(40),
    entry(39, { actor: LAYLA }),
    entry(38, { actor: LAYLA }),
    entry(37, { action: 'assigned', actor: LAYLA }),
    entry(36, { record: { id: 'r2', legacyId: 'CL-002' } }),
    entry(35),
    entry(25),
    entry(14),
  ];
  assert.deepEqual(shape(groupRepeats(items)), [
    [items[0].id],
    [items[1].id, items[2].id],
    [items[3].id],
    [items[4].id],
    [items[5].id, items[6].id],
    [items[7].id],
  ]);
});

test('the window is measured from the row’s newest entry', () => {
  const items = [entry(30), entry(24), entry(20), entry(19)];
  assert.deepEqual(shape(groupRepeats(items)), [
    [items[0].id, items[1].id, items[2].id],
    [items[3].id],
  ]);
});

test('unavailable records group by collection; team events by member', () => {
  const hidden = (minute, collection = 'Viewings') => entry(minute, { record: null, collection });
  const items = [hidden(9), hidden(8), hidden(7, 'Interaction log')];
  assert.deepEqual(shape(groupRepeats(items)), [[items[0].id, items[1].id], [items[2].id]]);
  const team = (minute, member) =>
    entry(minute, {
      kind: 'team',
      action: 'access_changed',
      collection: null,
      record: null,
      member,
    });
  const omar = { id: 'm1', name: 'Omar' };
  assert.equal(repeatKey(team(1, omar)), repeatKey(team(2, omar)));
  assert.notEqual(repeatKey(team(1, omar)), repeatKey(team(1, { id: 'm2', name: 'Sara' })));
});

test('Load more regroups the whole feed without duplicating or losing entries', () => {
  const first = [entry(50), entry(49), entry(48)];
  const second = [entry(47), entry(46), entry(30, { actor: LAYLA })];
  const before = groupRepeats(first);
  const after = groupRepeats([...first, ...second]);
  assert.equal(after[0].id, before[0].id);
  assert.equal(after[0].items.length, 5);
  const ids = after.flatMap((row) => row.items.map((item) => item.id));
  assert.deepEqual(
    ids,
    [...first, ...second].map((item) => item.id),
  );
  assert.equal(new Set(ids).size, ids.length);
});

test('rows never span two Dubai days because grouping runs inside each day', () => {
  const late = entry(0, { at: '2026-10-16T19:58:00Z' });
  const early = entry(0, { at: '2026-10-16T20:02:00Z' });
  const days = groupByDay([early, late], '2026-10-17').map((day) => groupRepeats(day.items));
  assert.deepEqual(days.map(shape), [[[early.id]], [[late.id]]]);
});
