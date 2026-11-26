import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import {
  add,
  assign,
  assigneeOf,
  assignees,
  assignmentTeams,
  bulkAssign,
  remove,
  setAssignee,
} from './assignment-helpers.mjs';
import { activate, invite } from './team-helpers.mjs';
import { MESSAGES, actions, forbidden, grant, preset } from './permission-helpers.mjs';

let admin, holder, agent, client;
const without = (module, key) => {
  const value = preset();
  value[module][key] = false;
  return value;
};

before(async () => {
  ({ admin, one: holder, two: agent } = await assignmentTeams('perm-assign'));
  agent = await grant(admin, agent, { actions: without('schedule', 'assign') });
  client = await add(admin, 'Clients', { client_id: 'PA-CL' });
  setAssignee(client.id, holder.user.id);
});

const followUp = async (id, assignee, linked = true) => {
  const entry = await add(admin, 'Follow-ups', {
    activity_id: id,
    ...(linked ? { client_id: 'PA-CL' } : {}),
  });
  setAssignee(entry.id, assignee);
  return entry;
};

test('without Assign a direct assignee may only return a client-linked follow-up (M-A)', async () => {
  assert.equal(agent.user.recordActions['Follow-ups'].assign, false);
  const task = await followUp('PA-FU-1', agent.user.id);
  forbidden(await assign(agent, 'Follow-ups', task, holder.user.id), MESSAGES.assign);
  const unknown = { id: randomUUID(), version: 1 };
  forbidden(await assign(agent, 'Follow-ups', unknown, holder.user.id), MESSAGES.assign);
  const returned = await assign(agent, 'Follow-ups', task, null);
  assert.equal(returned.status, 200, JSON.stringify(returned.value));
  assert.equal(returned.value.entry, null);
  assert.equal(assigneeOf(task.id), '-');
  const loose = await followUp('PA-FU-2', agent.user.id, false);
  forbidden(await assign(agent, 'Follow-ups', loose, null), MESSAGES.assign);
  const hidden = await followUp('PA-FU-3', admin.user.id, false);
  const missing = [hidden, unknown].map((entry) => assign(agent, 'Follow-ups', entry, null));
  const [first, second] = await Promise.all(missing);
  assert.equal(first.status, 404);
  assert.deepEqual(first.value, second.value);
});

test('a direct assignee who does not hold the client cannot delete its follow-up', async () => {
  const task = await followUp('PA-FU-DEL', agent.user.id);
  forbidden(await remove(agent, 'Follow-ups', task.id), MESSAGES.followUpDelete);
  const hidden = await followUp('PA-FU-HIDDEN', admin.user.id, false);
  const [first, second] = await Promise.all([
    remove(agent, 'Follow-ups', hidden.id),
    remove(agent, 'Follow-ups', randomUUID()),
  ]);
  assert.equal(first.status, 404);
  assert.deepEqual(first.value, second.value);
  const own = await followUp('PA-FU-OWN', agent.user.id, false);
  assert.equal((await remove(agent, 'Follow-ups', own.id)).status, 200);
  assert.equal((await remove(holder, 'Follow-ups', task.id)).status, 200);
});

test('assignee lists need Assign or whole-team visibility (L-5)', async () => {
  const quiet = await grant(admin, holder, { actions: without('relationships', 'assign') });
  forbidden(await assignees(quiet, 'Clients'), MESSAGES.assign);
  assert.equal((await assignees(quiet, 'Properties')).status, 200);
  const supervisor = await grant(admin, quiet, { recordScope: 'team' });
  assert.equal((await assignees(supervisor, 'Clients')).status, 200);
  holder = await grant(admin, supervisor, { recordScope: 'assigned', actions: preset() });
});

test('bulk moves need Assign on every listed collection (M-B)', async () => {
  const invited = await invite(admin, 'perm-bulk', { positions: ['property-agent'] });
  const lead = await grant(admin, await activate(invited), {
    recordScope: 'team',
    actions: without('relationships', 'assign'),
  });
  const task = await followUp('PA-BULK-FU', admin.user.id, false);
  const rows = [{ collection: 'Follow-ups', id: task.id, version: 1 }];
  const listed = [...rows, { collection: 'Clients', id: client.id, version: 1 }];
  forbidden(await bulkAssign(lead, { toId: holder.user.id, records: listed }), MESSAGES.assign);
  const moved = await bulkAssign(lead, { toId: holder.user.id, records: rows });
  assert.equal(moved.status, 200, JSON.stringify(moved.value));
  assert.equal(assigneeOf(task.id), holder.user.id);
  const viewer = await grant(admin, lead, { actions: actions(false) });
  forbidden(await bulkAssign(viewer, { toId: null, records: rows }), MESSAGES.assign);
});
