import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { activate, invite } from './team-helpers.mjs';
import {
  add,
  assigneeOf,
  assignmentTeams,
  bulkAssign,
  setScope,
  versionOf,
} from './assignment-helpers.mjs';

let admin, other, one, two, manager, rows;
const item = (collection, entry, version = entry.version) => ({
  collection,
  id: entry.id,
  version,
});
const unchanged = () => {
  for (const { id } of rows) {
    assert.equal(versionOf(id), 1);
    assert.equal(assigneeOf(id), admin.user.id);
  }
};

before(async () => {
  ({ admin, other, one, two } = await assignmentTeams('bulk'));
  manager = await setScope(admin, await activate(await invite(admin, 'bulk-manager')), 'team');
  rows = [
    item('Clients', await add(admin, 'Clients', { client_id: 'BULK-CL' })),
    item('Properties', await add(admin, 'Properties', { property_id: 'BULK-PR' })),
    item('Follow-ups', await add(admin, 'Follow-ups', { activity_id: 'BULK-FU' })),
  ];
});

test('bulk moves require team scope, every grant and CSRF', async () => {
  const body = { toId: two.user.id, records: rows };
  assert.equal((await bulkAssign(one, body)).status, 403);
  assert.equal((await bulkAssign(manager, body)).status, 403);
  assert.equal((await bulkAssign(admin, body, { csrf: undefined })).status, 403);
  assert.equal((await bulkAssign(admin, { records: rows })).status, 400);
  unchanged();
});

test('bulk moves are bounded, complete and current or change nothing', async () => {
  const many = Array.from({ length: 501 }, () => ({
    collection: 'Clients',
    id: randomUUID(),
    version: 1,
  }));
  for (const records of [[], many, [rows[0], rows[0]]]) {
    assert.equal((await bulkAssign(admin, { toId: two.user.id, records })).status, 400);
  }
  const huge = await bulkAssign(admin, { toId: null, note: 'x'.repeat(70000), records: rows });
  assert.ok([400, 413].includes(huge.status), String(huge.status));
  const foreign = await add(other, 'Clients', { client_id: 'BULK-FOREIGN' });
  // Unknown, other-team and wrong-collection rows each fail the whole request.
  for (const records of [
    [...rows, { collection: 'Clients', id: randomUUID(), version: 1 }],
    [...rows, item('Clients', foreign)],
    [rows[0], { ...rows[1], collection: 'Contacts' }],
  ]) {
    const result = await bulkAssign(admin, { toId: two.user.id, records });
    assert.equal(result.status, 404, JSON.stringify(records.at(-1)));
  }
  const stale = await bulkAssign(admin, {
    toId: two.user.id,
    records: [rows[0], { ...rows[1], version: 5 }],
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.value.code, 'version_conflict');
  const ineligible = await bulkAssign(admin, { toId: manager.user.id, records: rows });
  assert.equal(ineligible.status, 400);
  assert.equal(
    ineligible.value.message,
    'Choose an active team member with access to this record type.',
  );
  unchanged();
});

test('a bulk move writes one history row and note per changed record', async () => {
  const moved = await bulkAssign(admin, {
    toId: two.user.id,
    note: '  Quarterly handover  ',
    records: [...rows].reverse(),
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.value));
  assert.deepEqual(
    moved.value.entries.map((entry) => [entry.id, entry.version, entry.assignee]),
    [...rows].reverse().map(({ id }) => [id, 2, two.user.id]),
  );
  const ids = rows.map(({ id }) => `'${id}'`).join(',');
  assert.equal(
    query(
      `SELECT count(*) || ':' || count(DISTINCT n.note) || ':' || min(n.note) FROM crm_assignments h
       JOIN crm_assignment_notes n ON n.assignment_id=h.id
       WHERE h.record_id IN (${ids}) AND h.reason='bulk' AND h.actor_id='${admin.user.id}'`,
    ),
    '3:1:Quarterly handover',
  );
  assert.equal(
    query(`SELECT count(*) FROM crm_activity WHERE record_id IN (${ids}) AND action='assigned'`),
    '3',
  );
  const scoped = await bulkAssign(manager, {
    toId: null,
    records: [{ ...rows[0], version: 2 }],
  });
  assert.equal(scoped.status, 200);
  assert.equal(scoped.value.entries[0].assignee, null);
  const repeat = await bulkAssign(admin, {
    toId: two.user.id,
    records: [{ ...rows[1], version: 2 }],
  });
  assert.equal(repeat.value.entries[0].version, 2);
});
