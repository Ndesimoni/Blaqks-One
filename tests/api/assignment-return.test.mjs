import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { activate, invite } from './team-helpers.mjs';
import {
  add,
  assign,
  assigneeOf,
  assignmentTeams,
  history,
  list,
  setAssignee,
  versionOf,
} from './assignment-helpers.mjs';

let admin, one, two, three;
const CHAIN =
  "Only the client's holder, the Admin or a full-team member can pass this follow-up on. " +
  "You can return it to the client's holder.";
const QUEUE = 'Only your Admin can move records to the queue.';
const rows = (table, id) => query(`SELECT count(*) FROM ${table} WHERE record_id='${id}'`);
const sees = async (session, id) =>
  (await list(session)).records['Follow-ups'].some((entry) => entry.id === id);
const heldClient = async (legacy, holder) => {
  const client = await add(admin, 'Clients', {
    client_id: legacy,
    full_name: `Holder of ${legacy}`,
    phone: '+971500000123',
    email: `${legacy.toLowerCase()}@example.test`,
  });
  setAssignee(client.id, holder.user.id);
  return client;
};

before(async () => {
  ({ admin, one, two } = await assignmentTeams('ret'));
  three = await activate(await invite(admin, 'ret-three', { positions: ['property-agent'] }));
});

test('a non-holding direct assignee may only return a client-linked follow-up', async () => {
  await heldClient('RET-CL', one);
  const task = await add(admin, 'Follow-ups', { activity_id: 'RET-FU', client_id: 'RET-CL' });
  assert.equal(assigneeOf(task.id), '-');
  const handed = await assign(one, 'Follow-ups', task, two.user.id);
  assert.equal(handed.status, 200, JSON.stringify(handed.value));
  assert.equal(handed.value.entry.assignee, two.user.id);
  assert.ok((await list(two)).taskClients.some((client) => client.client_id === 'RET-CL'));
  const before = [versionOf(task.id), history(task.id), rows('crm_activity', task.id)];
  for (const target of [three, admin, one]) {
    const passed = await assign(two, 'Follow-ups', { ...task, version: 2 }, target.user.id, {
      body: { note: 'Pass it along' },
    });
    assert.equal(passed.status, 403, JSON.stringify(passed.value));
    assert.deepEqual(passed.value, { code: 'forbidden', message: CHAIN });
  }
  assert.equal(assigneeOf(task.id), two.user.id);
  assert.deepEqual([versionOf(task.id), history(task.id), rows('crm_activity', task.id)], before);
  assert.equal(rows('crm_assignment_notes', task.id), '0');
  const returned = await assign(two, 'Follow-ups', { ...task, version: 2 }, null);
  assert.equal(returned.status, 200, JSON.stringify(returned.value));
  assert.deepEqual(returned.value, { entry: null });
  assert.equal(assigneeOf(task.id), '-');
  assert.equal(versionOf(task.id), 3);
  assert.match(history(task.id), new RegExp(`,reassigned:-:${two.user.id}$`));
  assert.equal(await sees(two, task.id), false);
  assert.ok(!(await list(two)).taskClients.some((client) => client.client_id === 'RET-CL'));
  const back = (await list(one)).records['Follow-ups'].find((entry) => entry.id === task.id);
  assert.equal(back?.assignee, null);
  const rehanded = await assign(one, 'Follow-ups', { ...task, version: 3 }, three.user.id);
  assert.equal(rehanded.status, 200, JSON.stringify(rehanded.value));
  assert.equal(assigneeOf(task.id), three.user.id);
  assert.equal(await sees(three, task.id), true);
});

test('the Admin and full-team members still pass on follow-ups they do not hold', async () => {
  await heldClient('RET-CL-ADMIN', one);
  const task = await add(admin, 'Follow-ups', {
    activity_id: 'RET-FU-ADMIN',
    client_id: 'RET-CL-ADMIN',
  });
  setAssignee(task.id, two.user.id);
  const moved = await assign(admin, 'Follow-ups', task, three.user.id);
  assert.equal(moved.status, 200, JSON.stringify(moved.value));
  assert.equal(moved.value.entry.assignee, three.user.id);
  const cleared = await assign(admin, 'Follow-ups', { ...task, version: 2 }, null);
  assert.equal(cleared.status, 200);
  assert.equal(cleared.value.entry.assignee, null);
});

test('hidden and unknown follow-ups refuse a return with the same 404', async () => {
  await heldClient('RET-CL-HIDDEN', three);
  const hidden = await add(admin, 'Follow-ups', {
    activity_id: 'RET-FU-HIDDEN',
    client_id: 'RET-CL-HIDDEN',
  });
  const shapes = new Set();
  for (const id of [hidden.id, randomUUID()]) {
    const result = await assign(two, 'Follow-ups', { id, version: 1 }, null);
    shapes.add(`${result.status} ${JSON.stringify(result.value)}`);
  }
  assert.deepEqual([...shapes], ['404 {"code":"not_found","message":"Record not found."}']);
  assert.equal(assigneeOf(hidden.id), '-');
});

test('staff still cannot send a client-less follow-up or a client to the queue', async () => {
  const loose = await add(two, 'Follow-ups', { notes: 'Call the landlord' });
  assert.equal(loose.assignee, two.user.id);
  const queued = await assign(two, 'Follow-ups', loose, null);
  assert.equal(queued.status, 403);
  assert.deepEqual(queued.value, { code: 'forbidden', message: QUEUE });
  assert.equal(assigneeOf(loose.id), two.user.id);
  const client = await heldClient('RET-CL-QUEUE', two);
  const parent = await assign(two, 'Clients', client, null);
  assert.equal(parent.status, 403);
  assert.equal(parent.value.message, QUEUE);
  const handed = await assign(two, 'Follow-ups', loose, three.user.id);
  assert.equal(handed.status, 200, JSON.stringify(handed.value));
  assert.equal(handed.value.entry, null);
  assert.equal(assigneeOf(loose.id), three.user.id);
});
