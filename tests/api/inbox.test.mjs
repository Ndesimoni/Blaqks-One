import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, request } from './helpers.mjs';
import { inboxPath, inboxTeams, seed } from './inbox-helpers.mjs';

let teams;
const ids = {};

before(async () => {
  teams = await inboxTeams('inbox-read');
  const { workspace, agent } = teams;
  ids.whatsapp = seed(workspace, { channel: 'whatsapp' });
  ids.email = seed(workspace, { channel: 'email' });
  ids.held = seed(workspace, { channel: 'tiktok', assignee: agent.user.id, state: 'open' });
});

const listed = async (session, query = '') => {
  const result = await session.request(inboxPath(session, query));
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value.conversations.map((row) => row.id).sort();
};

test('each member sees the conversations their scope and reply grants allow', async () => {
  const { admin, agent, desk } = teams;
  const all = [ids.whatsapp, ids.email, ids.held].sort();
  assert.deepEqual(await listed(admin), all);
  assert.deepEqual(await listed(desk), all);
  assert.deepEqual(await listed(agent), [ids.whatsapp, ids.held].sort());
  assert.deepEqual(await listed(agent, '?assignee=me'), [ids.held]);
  assert.deepEqual(await listed(admin, '?channel=email'), [ids.email]);
  assert.deepEqual(
    await listed(admin, '?assignee=unassigned&state=new'),
    [ids.whatsapp, ids.email].sort(),
  );
});

test('other companies and the Super Admin are refused', async () => {
  const { admin, other } = teams;
  assert.equal((await other.request(inboxPath(admin))).status, 403);
  const owner = await login('owner');
  assert.equal((await owner.request(inboxPath(admin))).status, 403);
  assert.equal((await other.request(inboxPath(other, `/${ids.whatsapp}`))).status, 404);
  assert.equal((await request(inboxPath(admin))).status, 401);
  assert.equal((await admin.request(inboxPath(admin, '?state=closed'))).status, 400);
});

test('reading shows messages, notes and the unread mark, never hidden threads', async () => {
  const { agent } = teams;
  assert.equal((await agent.request(inboxPath(agent, `/${ids.email}`))).status, 404);
  assert.equal((await agent.request(inboxPath(agent, '/not-a-uuid'))).status, 404);
  const first = await agent.request(inboxPath(agent, `/${ids.held}`));
  assert.equal(first.status, 200, JSON.stringify(first.value));
  assert.equal(first.value.conversation.unread, true);
  assert.equal(first.value.messages.length, 1);
  assert.equal(first.value.messages[0].body, 'Synthetic enquiry for tiktok');
  assert.deepEqual(first.value.notes, []);
  const read = await agent.request(inboxPath(agent, `/${ids.held}/read`), { method: 'POST' });
  assert.equal(read.status, 204);
  const after = await agent.request(inboxPath(agent, `/${ids.held}`));
  assert.equal(after.value.conversation.unread, false);
});

test('internal notes stay apart from messages', async () => {
  const { agent } = teams;
  const note = await agent.request(inboxPath(agent, `/${ids.held}/notes`), {
    method: 'POST',
    body: { body: 'Synthetic note: call after five' },
  });
  assert.equal(note.status, 201, JSON.stringify(note.value));
  const view = (await agent.request(inboxPath(agent, `/${ids.held}`))).value;
  assert.equal(view.notes.length, 1);
  assert.equal(view.notes[0].authorId, agent.user.id);
  assert.ok(view.messages.every((message) => !message.body.includes('Synthetic note')));
  const hidden = await agent.request(inboxPath(agent, `/${ids.email}/notes`), {
    method: 'POST',
    body: { body: 'Should not land' },
  });
  assert.equal(hidden.status, 404);
  const empty = await agent.request(inboxPath(agent, `/${ids.held}/notes`), {
    method: 'POST',
    body: { body: '   ' },
  });
  assert.equal(empty.status, 400);
});

test('every page lists each visible conversation once', async () => {
  const { admin } = teams;
  const seen = [];
  let cursor = null;
  do {
    const query = `?limit=1${cursor ? `&cursor=${cursor}` : ''}`;
    const page = await admin.request(inboxPath(admin, query));
    assert.equal(page.status, 200);
    seen.push(...page.value.conversations.map((row) => row.id));
    cursor = page.value.nextCursor;
  } while (cursor && seen.length < 10);
  assert.deepEqual(seen.sort(), [ids.whatsapp, ids.email, ids.held].sort());
});
