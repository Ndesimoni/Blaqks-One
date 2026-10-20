import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create, login } from './helpers.mjs';
import { inboxPath, inboxTeams, seed } from './inbox-helpers.mjs';
import { actions, grant } from './permission-helpers.mjs';
import { activate, invite } from './team-helpers.mjs';

let teams;

before(async () => {
  teams = await inboxTeams('inbox-guards');
});

const act = (session, id, action, body) =>
  session.request(inboxPath(session, `/${id}/${action}`), { method: 'POST', body });

test('a linked record stays hidden from viewers who cannot see it', async () => {
  const { admin, agent, workspace } = teams;
  const client = await create(admin, 'Clients', { full_name: 'Synthetic Admin-only Client' });
  const id = seed(workspace, { match: 'linked', record: client.id });
  const listed = await agent.request(inboxPath(agent));
  const row = listed.value.conversations.find((item) => item.id === id);
  assert.deepEqual(row.linked, { collection: 'Clients', recordId: null });
  const read = await agent.request(inboxPath(agent, `/${id}`));
  assert.equal(read.value.conversation.linked.recordId, null);
  assert.deepEqual(read.value.conversation.record, { collection: 'Clients', unavailable: true });
  assert.ok(!JSON.stringify(read.value).includes(client.id));
  const own = await admin.request(inboxPath(admin, `/${id}`));
  assert.equal(own.value.conversation.linked.recordId, client.id);
});

test('several matches need the Admin or a link, never a staff duplicate', async () => {
  const { admin, agent, workspace } = teams;
  const id = seed(workspace, { match: 'choice', assignee: agent.user.id });
  const refused = await act(agent, id, 'lead', { expectedVersion: 1 });
  assert.equal(refused.status, 409);
  const created = await act(admin, id, 'lead', { expectedVersion: 1 });
  assert.equal(created.status, 200, JSON.stringify(created.value));
});

test('creating a lead needs the Clients create grant, and the Super Admin acts on nothing', async () => {
  const { admin, workspace } = teams;
  const invited = await activate(
    await invite(admin, 'inbox-guards-view', { positions: ['property-agent'] }),
  );
  const viewOnly = await grant(admin, invited, { recordScope: 'team', actions: actions(false) });
  const id = seed(workspace);
  const denied = await act(viewOnly, id, 'lead', { expectedVersion: 1 });
  assert.equal(denied.status, 403, JSON.stringify(denied.value));
  const owner = await login('owner');
  const link = { collection: 'Clients', recordId: '00000000-0000-4000-8000-000000000001' };
  for (const [path, extra] of [
    ['lead', {}],
    ['link', link],
    ['resolve', {}],
    ['block', {}],
  ]) {
    const result = await owner.request(inboxPath(admin, `/${id}/${path}`), {
      method: 'POST',
      body: { expectedVersion: 1, ...extra },
    });
    assert.equal(result.status, 403, path);
  }
  assert.equal((await owner.request(`/workspaces/${workspace}/inbox/rules`)).status, 403);
});

test('a blocked conversation cannot be resolved or reopened until unblocked', async () => {
  const { admin, workspace } = teams;
  const id = seed(workspace, { state: 'spam' });
  assert.equal((await act(admin, id, 'resolve', { expectedVersion: 1 })).status, 409);
  const reopen = await admin.request(inboxPath(admin, `/${id}`), {
    method: 'PATCH',
    body: { expectedVersion: 1, state: 'open' },
  });
  assert.equal(reopen.status, 409);
  assert.equal((await act(admin, id, 'block', { expectedVersion: 1 })).status, 409);
});
