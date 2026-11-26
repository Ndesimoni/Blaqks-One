import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import { messages, rooms, send } from './chat-helpers.mjs';
import { ORGANISATION, teamMember } from './platform-team-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

const general = async (session) => (await rooms(session)).rooms.find((r) => r.name === 'general');
const orgChat = (suffix = '') => `/workspaces/${ORGANISATION}/chat${suffix}`;

// BO1f (docs/blaqks-one-console.md §11): the Blaqks One team chats among itself, and the
// two sides never read each other's chat.
test('the Owner and platform staff share #general in the Blaqks One organisation', async () => {
  const owner = await login('owner');
  const sales = await teamMember(owner, 'chat-sales', 'sales');
  const room = await general(owner);
  assert.ok(room, 'the organisation has #general');
  assert.equal((await rooms(owner)).canCreateChannel, true, 'the Owner moderates');
  assert.equal((await rooms(sales)).canCreateChannel, false);
  assert.equal((await send(owner, room.id, 'Synthetic welcome to the team')).status, 201);
  const seen = await messages(sales, room.id);
  assert.ok(seen.some((message) => message.body === 'Synthetic welcome to the team'));
  const people = (await rooms(sales)).people.map((person) => person.id);
  assert.ok(people.includes(owner.user.id), 'the Owner is someone to message');
});

test('companies never reach the Blaqks One chat, and the team never reaches theirs', async () => {
  const owner = await login('owner');
  const admin = await login('admin-a');
  const analyst = await teamMember(owner, 'chat-analyst', 'analyst');
  for (const session of [admin, await login('admin-b')]) {
    assert.equal((await session.request(orgChat())).status, 403);
    const room = await general(owner);
    const post = await session.request(orgChat(`/rooms/${room.id}/messages`), {
      method: 'POST',
      body: { body: 'Synthetic intruder' },
    });
    assert.equal(post.status, 403);
  }
  const company = `/workspaces/${admin.user.workspaceId}/chat`;
  for (const session of [owner, analyst]) {
    assert.equal((await session.request(company)).status, 403);
    assert.equal((await session.request(`${company}/summary`)).status, 403);
  }
  const people = (await rooms(admin)).people.map((person) => person.id);
  assert.ok(!people.includes(owner.user.id) && !people.includes(analyst.user.id));
});
