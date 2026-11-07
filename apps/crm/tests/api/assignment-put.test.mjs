import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import {
  add,
  assign,
  assigneeOf,
  assignmentTeams,
  list,
  setAssignee,
  setScope,
  versionOf,
  workspacePath,
} from './assignment-helpers.mjs';

let admin, one, two;
const REASSIGN =
  'Only the current assignee, the Admin or a full-team member can reassign this record.';
const held = async (collection, record, holder) => {
  const entry = await add(admin, collection, record);
  setAssignee(entry.id, holder?.user.id);
  return entry;
};

before(async () => ({ admin, one, two } = await assignmentTeams('put')));

test('holders hand records over and lose sight of them unless they have team scope', async () => {
  const client = await held('Clients', { client_id: 'PUT-CL', full_name: 'Handed' }, one);
  const unprotected = await assign(one, 'Clients', client, two.user.id, { csrf: false });
  assert.equal(unprotected.status, 403);
  const queued = await assign(one, 'Clients', client, null);
  assert.equal(queued.status, 403);
  assert.equal(queued.value.message, 'Only your Admin can move records to the queue.');
  const missing = await one.request(`${workspacePath(one, 'Clients', client.id)}/assignee`, {
    method: 'PUT',
    body: { version: 1 },
  });
  assert.equal(missing.status, 400);
  const stale = await assign(one, 'Clients', { ...client, version: 4 }, two.user.id);
  assert.equal(stale.status, 409);
  assert.equal(stale.value.code, 'version_conflict');
  const handed = await assign(one, 'Clients', client, two.user.id, {
    body: { note: 'Prefers WhatsApp' },
  });
  assert.equal(handed.status, 200, JSON.stringify(handed.value));
  assert.deepEqual(handed.value, { entry: null });
  assert.equal(assigneeOf(client.id), two.user.id);
  assert.equal(versionOf(client.id), 2);
  assert.ok(!(await list(one)).records.Clients.some((entry) => entry.id === client.id));
  const back = await assign(two, 'Clients', { ...client, version: 2 }, one.user.id);
  assert.equal(back.status, 200);
  assert.equal(back.value.entry, null);
  const kept = await assign(admin, 'Clients', { ...client, version: 3 }, null);
  assert.equal(kept.status, 200);
  assert.equal(kept.value.entry.assignee, null);
  assert.equal(kept.value.entry.version, 4);
  assert.equal(
    query(
      `SELECT string_agg(action, ',' ORDER BY created_at) FROM crm_activity WHERE record_id='${client.id}'`,
    ),
    'created,assigned,assigned,assigned',
  );
});

test('only the holder may reassign a visible record they do not hold', async () => {
  await held('Clients', { client_id: 'PUT-CL-ONE' }, one);
  const task = await held('Follow-ups', { activity_id: 'PUT-FU', client_id: 'PUT-CL-ONE' }, two);
  // The owner contact stays with the Admin but is visible through one's property.
  const contact = await add(admin, 'Contacts', { contact_id: 'PUT-CT' });
  await held('Properties', { property_id: 'PUT-PR', contact_id: 'PUT-CT' }, one);
  for (const [collection, entry] of [
    ['Follow-ups', task],
    ['Contacts', contact],
  ]) {
    const result = await assign(one, collection, entry, one.user.id);
    assert.equal(result.status, 403, collection);
    assert.equal(result.value.message, REASSIGN);
  }
  const inherited = await held('Follow-ups', {
    activity_id: 'PUT-FU-OWN',
    client_id: 'PUT-CL-ONE',
  });
  const direct = await assign(one, 'Follow-ups', inherited, two.user.id);
  assert.equal(direct.status, 200, JSON.stringify(direct.value));
  assert.equal(direct.value.entry.assignee, two.user.id);
  const manager = await setScope(admin, two, 'team');
  const moved = await assign(manager, 'Contacts', contact, one.user.id);
  assert.equal(moved.status, 200);
  assert.equal(moved.value.entry.assignee, one.user.id);
  await setScope(admin, manager, 'assigned');
});

test('hidden and unknown targets and unassignable collections are refused alike', async () => {
  const hidden = await held('Clients', { client_id: 'PUT-HIDDEN' }, two);
  const shapes = new Set();
  for (const id of [hidden.id, randomUUID()]) {
    const result = await assign(one, 'Clients', { id, version: 1 }, one.user.id);
    shapes.add(`${result.status} ${JSON.stringify(result.value)}`);
  }
  assert.deepEqual([...shapes], ['404 {"code":"not_found","message":"Record not found."}']);
  const viewing = await add(one, 'Viewings', { client_id: 'PUT-CL-ONE' });
  const unassignable = await assign(one, 'Viewings', viewing, one.user.id);
  assert.equal(unassignable.status, 400);
  assert.equal(unassignable.value.message, 'This record type cannot be assigned.');
  const long = await assign(admin, 'Clients', hidden, one.user.id, {
    body: { note: 'x'.repeat(1001) },
  });
  assert.equal(long.status, 400);
  assert.equal(assigneeOf(hidden.id), two.user.id);
});
