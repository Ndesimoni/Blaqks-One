import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dubaiToday,
  effectiveRange,
  rangeError,
  readFilters,
  requestParams,
  writeFilters,
} from '../../src/features/server/activity/activityFilters.js';
import {
  dayLabel,
  describe,
  dubaiDay,
  groupByDay,
  recordName,
  timeLabel,
} from '../../src/features/server/activity/activityModel.js';

const ME = '00000000-0000-4000-8000-000000000001';
const LAYLA = { id: '00000000-0000-4000-8000-000000000002', name: 'Layla Synthetic' };
const item = (changes = {}) => ({
  id: 'a1',
  at: '2026-10-15T21:30:00.000Z',
  kind: 'record',
  action: 'created',
  collection: 'Clients',
  actor: LAYLA,
  record: { id: 'r1', legacyId: 'CL-001' },
  member: null,
  sample: false,
  ...changes,
});

test('filters round-trip through the URL and keep unrelated parameters', () => {
  const search = '?workspace=w1&from=2026-10-01&to=2026-10-31&type=team&member=nope&action=DROP';
  const filters = readFilters(search);
  assert.deepEqual(filters, {
    from: '2026-10-01',
    to: '2026-10-31',
    member: '',
    type: 'team',
    section: '',
    action: '',
  });
  assert.equal(readFilters('?from=2026-02-30').from, '');
  const written = writeFilters(search, { ...filters, type: '', section: 'Deals' });
  assert.equal(written, '?workspace=w1&from=2026-10-01&to=2026-10-31&section=Deals');
});

test('ranges default to 90 Dubai days and are validated before any request', () => {
  assert.equal(dubaiToday(Date.parse('2026-10-15T20:30:00Z')), '2026-10-16');
  const today = '2026-10-16';
  assert.deepEqual(effectiveRange(readFilters(''), today), { from: '2026-07-19', to: today });
  assert.equal(rangeError({ from: '2026-10-02', to: '2026-10-01' }, today) !== '', true);
  assert.notEqual(rangeError({ from: '2025-01-01', to: '2026-01-02' }, today), '');
  assert.equal(rangeError({ from: '2025-01-01', to: '2026-01-01' }, today), '');
  const filters = { ...readFilters(''), member: ME, type: 'team', section: 'Deals' };
  const staff = requestParams(filters, { manager: false }, today);
  assert.equal(staff.actor, '');
  assert.equal(staff.kind, '');
  const manager = requestParams(filters, { manager: true }, today);
  assert.deepEqual(manager, {
    from: '2026-07-19',
    to: today,
    actor: ME,
    kind: 'team',
    collection: '',
    action: '',
    limit: 50,
  });
});

test('entries group by Dubai day in server order and read as plain sentences', () => {
  assert.equal(dubaiDay('2026-10-15T21:30:00.000Z'), '2026-10-16');
  assert.equal(timeLabel('2026-10-15T21:30:00.000Z'), '01:30');
  assert.equal(dayLabel('2026-10-16', '2026-10-16'), 'Today');
  assert.equal(dayLabel('2026-10-15', '2026-10-16'), 'Yesterday');
  assert.equal(dayLabel('2026-10-14', '2026-10-16'), 'Wednesday 14 October 2026');
  const rows = [item(), item({ id: 'a2', at: '2026-10-15T08:00:00.000Z' }), item({ id: 'a3' })];
  const groups = groupByDay(rows, '2026-10-16');
  assert.deepEqual(
    groups.map((group) => [group.label, group.items.map((row) => row.id)]),
    [
      ['Today', ['a1']],
      ['Yesterday', ['a2']],
      ['Today', ['a3']],
    ],
  );
  const deal = item({
    action: 'earned',
    collection: 'Deals',
    record: { id: 'd', legacyId: 'DL-004' },
  });
  const text = describe(deal, { userId: ME, entries: {} });
  assert.equal(
    `${text.actor} ${text.verb} ${text.noun} ${text.object}`,
    'Layla Synthetic earned deal DL-004',
  );
  const mine = describe(item({ actor: { id: ME, name: 'Me' } }), { userId: ME, entries: {} });
  assert.equal(mine.actor, 'You');
  const invite = item({ kind: 'team', action: 'invited', collection: null, record: null });
  const team = describe({ ...invite, member: { id: 'm', name: 'Omar Haddad' } }, { userId: ME });
  assert.equal(`${team.actor} ${team.verb} ${team.object}`, 'Layla Synthetic invited Omar Haddad');
  const joined = describe({ ...invite, action: 'activated', member: LAYLA }, { userId: ME });
  assert.equal(`${joined.actor} ${joined.verb}`, 'Layla Synthetic joined the team');
});

test('record names come only from the scoped cache; null records are unavailable', () => {
  const entries = {
    Clients: [{ id: 'r1', record: { client_id: 'CL-001', full_name: 'Sara Example' } }],
    Viewings: [{ id: 'v1', record: { viewing_id: 'VW-002', client_id: 'CL-001' } }],
  };
  assert.equal(recordName(item(), entries), 'Sara Example');
  assert.equal(recordName(item(), {}), 'CL-001');
  const viewing = item({ collection: 'Viewings', record: { id: 'v1', legacyId: 'VW-002' } });
  assert.equal(recordName(viewing, entries), 'VW-002 · Sara Example');
  assert.equal(recordName(item({ record: null }), entries), null);
  const hidden = describe(item({ record: null, collection: 'Interaction log' }), {
    userId: ME,
    entries,
  });
  assert.equal(hidden.noun, 'an interaction');
  assert.equal(hidden.object, null);
});
