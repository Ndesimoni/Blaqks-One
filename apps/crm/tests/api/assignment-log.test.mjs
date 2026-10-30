import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { findMember, memberUpdate, staffLogin, teamPath } from './team-helpers.mjs';
import {
  add,
  assign,
  assignmentLog,
  assignmentTeams,
  remove,
  versionOf,
} from './assignment-helpers.mjs';

let admin, one, two, client;
const NOTE = 'Synthetic handover note 7f3a';
const person = (session) => ({ id: session.user.id, name: session.user.name });

before(async () => {
  ({ admin, one, two } = await assignmentTeams('log'));
  client = await add(admin, 'Clients', { client_id: 'LOG-CL', full_name: 'Logged' });
  const moved = await assign(admin, 'Clients', client, one.user.id, { body: { note: NOTE } });
  assert.equal(moved.status, 200);
});

test('visible records expose their history with names and the hand-off note', async () => {
  const result = await assignmentLog(one, 'Clients', client.id);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  const entries = result.value.history.map(({ at, ...entry }) => {
    assert.match(at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    return entry;
  });
  assert.deepEqual(entries, [
    { reason: 'created', from: null, to: person(admin), actor: person(admin), note: null },
    {
      reason: 'reassigned',
      from: person(admin),
      to: person(one),
      actor: person(admin),
      note: NOTE,
    },
  ]);
  const shapes = new Set();
  for (const id of [client.id, randomUUID()]) {
    const hidden = await assignmentLog(two, 'Clients', id);
    shapes.add(`${hidden.status} ${JSON.stringify(hidden.value)}`);
  }
  assert.deepEqual([...shapes], ['404 {"code":"not_found","message":"Record not found."}']);
  const unassignable = await assignmentLog(one, 'Viewings', client.id);
  assert.equal(unassignable.status, 400);
  assert.equal(query(`SELECT count(*) FROM crm_activity a WHERE a::text LIKE '%${NOTE}%'`), '0');
  assert.equal(
    query(`SELECT count(*) FROM crm_team_activity a WHERE a::text LIKE '%${NOTE}%'`),
    '0',
  );
});

test('staff see releases as a generic Admin reassignment', async () => {
  const member = await findMember(admin, one.user.id);
  const revoke = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { permissions: { ...member.permissions, relationships: false } }),
  });
  assert.equal(revoke.status, 200);
  const latest = await findMember(admin, one.user.id);
  const restore = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(latest, { permissions: member.permissions }),
  });
  assert.equal(restore.status, 200);
  const back = await assign(
    admin,
    'Clients',
    { ...client, version: versionOf(client.id) },
    one.user.id,
  );
  assert.equal(back.status, 200);
  const staff = await staffLogin(member.email);
  const seen = (await assignmentLog(staff, 'Clients', client.id)).value.history;
  assert.deepEqual(
    seen.map(({ reason, actor }) => [reason, actor]),
    [
      ['created', person(admin)],
      ['reassigned', person(admin)],
      ['admin_reassigned', null],
      ['reassigned', person(admin)],
    ],
  );
  const full = (await assignmentLog(admin, 'Clients', client.id)).value.history;
  assert.equal(full[2].reason, 'access_removed');
  assert.deepEqual(full[2].actor, person(admin));
});

test('deleting a record removes its notes but keeps its assignment history', async () => {
  const before = query(`SELECT count(*) FROM crm_assignments WHERE record_id='${client.id}'`);
  assert.equal(before, '4');
  const deleted = await remove(admin, 'Clients', client.id, versionOf(client.id));
  assert.equal(deleted.status, 200);
  assert.equal(
    query(`SELECT count(*) FROM crm_assignment_notes WHERE record_id='${client.id}'`),
    '0',
  );
  assert.equal(
    query(`SELECT count(*) FROM crm_assignments WHERE record_id='${client.id}'`),
    before,
  );
  assert.equal((await assignmentLog(admin, 'Clients', client.id)).status, 404);
});
