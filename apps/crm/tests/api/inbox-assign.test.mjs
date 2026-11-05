import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { request } from './helpers.mjs';
import { events, inboxPath, inboxTeams, seed } from './inbox-helpers.mjs';

let teams;

before(async () => {
  teams = await inboxTeams('inbox-assign');
});

const patch = (session, id, body) =>
  session.request(inboxPath(session, `/${id}`), { method: 'PATCH', body });

test('assigned-only staff claim Unassigned conversations and release their own', async () => {
  const { agent, admin, workspace } = teams;
  const id = seed(workspace, { channel: 'whatsapp' });
  const claimed = await patch(agent, id, { expectedVersion: 1, assigneeId: agent.user.id });
  assert.equal(claimed.status, 200, JSON.stringify(claimed.value));
  assert.equal(claimed.value.conversation.assigneeId, agent.user.id);
  assert.equal(events(id, 'assigned'), '1');
  const handOn = await patch(agent, id, { expectedVersion: 2, assigneeId: admin.user.id });
  assert.equal(handOn.status, 403);
  const released = await patch(agent, id, { expectedVersion: 2, assigneeId: null });
  assert.equal(released.status, 200);
  assert.equal(released.value.conversation.assigneeId, null);
});

test('managers assign within the team only, with versions', async () => {
  const { admin, agent, other, workspace } = teams;
  const id = seed(workspace, { channel: 'email' });
  const given = await patch(admin, id, { expectedVersion: 1, assigneeId: agent.user.id });
  assert.equal(given.status, 200, JSON.stringify(given.value));
  const stale = await patch(admin, id, { expectedVersion: 1, state: 'resolved' });
  assert.equal(stale.status, 409);
  const foreign = await patch(admin, id, { expectedVersion: 2, assigneeId: other.user.id });
  assert.equal(foreign.status, 400);
  const resolved = await patch(admin, id, { expectedVersion: 2, state: 'resolved' });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.value.conversation.state, 'resolved');
  assert.equal(events(id, 'state_changed'), '1');
  assert.equal((await patch(admin, id, { expectedVersion: 3, state: 'spam' })).status, 400);
});

test('writes need the CSRF token and a visible conversation', async () => {
  const { admin, agent, other, workspace } = teams;
  const id = seed(workspace, { channel: 'email' });
  const forged = await request(inboxPath(admin, `/${id}`), {
    method: 'PATCH',
    cookie: admin.cookie,
    body: { expectedVersion: 1, state: 'open' },
  });
  assert.equal(forged.status, 403);
  assert.equal((await patch(agent, id, { expectedVersion: 1, state: 'open' })).status, 404);
  assert.equal((await patch(other, id, { expectedVersion: 1, state: 'open' })).status, 404);
});
