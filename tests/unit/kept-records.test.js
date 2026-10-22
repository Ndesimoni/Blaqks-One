import test from 'node:test';
import assert from 'node:assert/strict';
import { keptBadge, readKept } from '../../src/features/server/keptRecords.js';
import { connectedCollections, readServerRecords } from '../../src/features/server/records.js';

// H3 (agreements design §18): handed-over clients and listings a member keeps reading.
const badge = (extra = {}) => ({
  ...{ reason: 'handed_over', other: { id: 'u-2', name: 'Layla' }, dealId: 'DL-001' },
  ...{ kind: 'full', referralShareBp: null, at: '2026-10-22T18:00:00.000Z' },
  ...extra,
});

test('keep badges are read strictly', () => {
  const kept = readKept({
    'r-1': badge(),
    'r-2': badge({ kind: 'referral', referralShareBp: 1500 }),
  });
  assert.deepEqual(kept['r-1'], badge());
  assert.equal(kept['r-2'].referralShareBp, 1500);
  assert.deepEqual(readKept(), {});
  for (const bad of [
    badge({ reason: 'stolen' }),
    badge({ kind: 'referral' }),
    badge({ other: { id: 'u-2' } }),
    badge({ dealId: '' }),
  ])
    assert.throws(() => readKept({ 'r-1': bad }), /invalid record list/);
  assert.throws(() => readKept([]));
});

test('a kept record is found through its entry, and other records are not kept', () => {
  const entries = {
    Clients: [
      { id: 'r-1', record: { client_id: 'CL-001' } },
      { id: 'r-9', record: { client_id: 'CL-009' } },
    ],
  };
  const kept = readKept({ 'r-1': badge() });
  assert.equal(keptBadge(entries, kept, 'Clients', { client_id: 'CL-001' }).dealId, 'DL-001');
  assert.equal(keptBadge(entries, kept, 'Clients', { client_id: 'CL-009' }), null);
  assert.equal(keptBadge(entries, kept, 'Clients', null), null);
});

test('the record list carries its keeps', () => {
  const empty = Object.fromEntries(connectedCollections.map((name) => [name, []]));
  const payload = {
    ...{ records: empty, scope: 'assigned', references: {}, taskClients: [] },
    ...{ listingViewings: [], dealLinks: [] },
  };
  const row = { id: 'r-1', version: 3, record: { client_id: 'CL-001' }, assignee: 'u-2' };
  const records = { ...empty, Clients: [row] };
  const parsed = readServerRecords({ ...payload, records, kept: { 'r-1': badge() } });
  assert.equal(parsed.kept['r-1'].other.name, 'Layla');
  assert.deepEqual(parsed.entries.Clients, [], 'kept rows are not the caller’s own');
  assert.equal(parsed.keptEntries.Clients[0].id, 'r-1');
  assert.deepEqual(readServerRecords(payload).kept, {}, 'older responses have none');
});
