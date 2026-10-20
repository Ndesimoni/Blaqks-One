import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create, query } from './helpers.mjs';
import { events, inboxPath, inboxTeams, seed } from './inbox-helpers.mjs';

let teams;

before(async () => {
  teams = await inboxTeams('inbox-triage');
});

const act = (session, id, action, body) =>
  session.request(inboxPath(session, `/${id}/${action}`), { method: 'POST', body });

const leadsFor = (id) =>
  query(
    `SELECT count(*) FROM crm_records r JOIN inbox.crm_inbox_conversations c
       ON r.payload->>'phone'=c.contact_display
     WHERE c.id='${id}' AND r.collection='Clients' AND r.workspace_id=c.workspace_id`,
  );

test('two people creating a lead from one message create one lead', async () => {
  const { admin, desk, workspace } = teams;
  const id = seed(workspace, { channel: 'whatsapp' });
  const [first, second] = await Promise.all([
    act(admin, id, 'lead', { expectedVersion: 1, name: 'Synthetic New Lead' }),
    act(desk, id, 'lead', { expectedVersion: 1 }),
  ]);
  const statuses = [first.status, second.status].sort();
  assert.deepEqual(statuses, [200, 409], JSON.stringify([first.value, second.value]));
  const won = first.status === 200 ? first : second;
  assert.equal(won.value.conversation.match, 'linked');
  assert.equal(won.value.conversation.linked.collection, 'Clients');
  assert.equal(won.value.conversation.state, 'open');
  assert.equal(leadsFor(id), '1');
  assert.equal(events(id, 'lead_created'), '1');
  const again = await act(admin, id, 'lead', { expectedVersion: 2 });
  assert.equal(again.status, 409);
});

test('linking needs a record the caller can see', async () => {
  const { admin, agent, workspace } = teams;
  const client = await create(admin, 'Clients', { full_name: 'Synthetic Existing Client' });
  const mine = seed(workspace, { channel: 'whatsapp' });
  const hidden = await act(agent, mine, 'link', {
    expectedVersion: 1,
    collection: 'Clients',
    recordId: client.id,
  });
  assert.equal(hidden.status, 404);
  const unknown = await act(admin, mine, 'link', {
    expectedVersion: 1,
    collection: 'Clients',
    recordId: '00000000-0000-4000-8000-000000000000',
  });
  assert.equal(unknown.status, 404);
  const deals = await act(admin, mine, 'link', {
    expectedVersion: 1,
    collection: 'Deals',
    recordId: client.id,
  });
  assert.equal(deals.status, 400);
  const linked = await act(admin, mine, 'link', {
    expectedVersion: 1,
    collection: 'Clients',
    recordId: client.id,
  });
  assert.equal(linked.status, 200, JSON.stringify(linked.value));
  assert.equal(linked.value.conversation.linked.recordId, client.id);
  const read = await admin.request(inboxPath(admin, `/${mine}`));
  assert.equal(read.value.conversation.record.name, 'Synthetic Existing Client');
});

test('not a lead resolves, and only the Admin or the holder blocks', async () => {
  const { admin, agent, workspace } = teams;
  const quiet = seed(workspace, { channel: 'whatsapp' });
  const resolved = await act(agent, quiet, 'resolve', { expectedVersion: 1 });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.value.conversation.state, 'resolved');
  const spam = seed(workspace, { channel: 'whatsapp' });
  assert.equal((await act(agent, spam, 'block', { expectedVersion: 1 })).status, 403);
  const blocked = await act(admin, spam, 'block', { expectedVersion: 1 });
  assert.equal(blocked.status, 200);
  assert.equal(blocked.value.conversation.state, 'spam');
  const stored = () =>
    query(`SELECT count(*) FROM inbox.crm_inbox_blocks b JOIN inbox.crm_inbox_conversations c
      ON b.contact_key=c.contact_key AND b.workspace_id=c.workspace_id WHERE c.id='${spam}'`);
  assert.equal(stored(), '1');
  assert.equal((await act(agent, spam, 'unblock', { expectedVersion: 2 })).status, 403);
  const lifted = await act(admin, spam, 'unblock', { expectedVersion: 2 });
  assert.equal(lifted.status, 200);
  assert.equal(lifted.value.conversation.state, 'resolved');
  assert.equal(stored(), '0');
});

test('only the company Admin reads and edits the lead rules', async () => {
  const { admin, agent, other } = teams;
  const path = `/workspaces/${admin.user.workspaceId}/inbox/rules`;
  const defaults = await admin.request(path);
  assert.equal(defaults.status, 200);
  assert.equal(defaults.value.rules.version, 0);
  assert.equal(defaults.value.rules.leadMode, 'suggest');
  const body = { ...defaults.value.rules, expectedVersion: 0, leadMode: 'create' };
  delete body.version;
  const saved = await admin.request(path, { method: 'PUT', body });
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
  assert.equal(saved.value.rules.version, 1);
  assert.equal(saved.value.rules.leadMode, 'create');
  assert.equal((await admin.request(path, { method: 'PUT', body })).status, 409);
  assert.equal((await agent.request(path)).status, 403);
  assert.equal((await other.request(path, { method: 'PUT', body })).status, 403);
});
