import assert from 'node:assert/strict';
import test from 'node:test';
import { login } from './helpers.mjs';
import { activate, findMember, invite, memberUpdate, teamPath } from './team-helpers.mjs';

const admin = await login('admin-a');
const chat = (session, suffix = '') => `/workspaces/${session.user.workspaceId}/chat${suffix}`;
const rooms = async (session) => (await session.request(chat(session))).value;
const send = (session, room, body) =>
  session.request(chat(session, `/rooms/${room}/messages`), { method: 'POST', body: { body } });
const staff = async (suffix) => activate(await invite(admin, suffix));
const general = async (session) => (await rooms(session)).rooms.find((r) => r.name === 'general');

test('every company has #general; only the Admin creates channels', async () => {
  const member = await staff('chat-channels');
  const mine = await rooms(admin);
  assert.equal(mine.canCreateChannel, true);
  assert.ok(await general(admin));
  assert.ok(mine.people.some((person) => person.id === member.user.id));
  assert.equal((await rooms(member)).canCreateChannel, false);
  const create = (session, name) =>
    session.request(chat(session, '/channels'), { method: 'POST', body: { name } });
  assert.equal((await create(member, 'sales')).status, 403);
  const made = await create(admin, '#Sales');
  assert.equal(made.status, 201, JSON.stringify(made.value));
  assert.equal(made.value.room.name, 'sales');
  assert.equal((await create(admin, 'sales')).status, 409);
  assert.equal((await create(admin, 'two words')).status, 400);
  assert.ok((await rooms(member)).rooms.some((room) => room.name === 'sales'));
});

test('channel messages reach everyone and unread counts clear when read', async () => {
  const member = await staff('chat-unread');
  const room = (await general(admin)).id;
  const sent = await send(admin, room, 'Team meeting at 10 tomorrow.');
  assert.equal(sent.status, 201, JSON.stringify(sent.value));
  const list = await member.request(chat(member, `/rooms/${room}/messages`));
  assert.ok(list.value.messages.some((message) => message.body === 'Team meeting at 10 tomorrow.'));
  assert.ok((await member.request(chat(member, '/summary'))).value.unread >= 1);
  await member.request(chat(member, `/rooms/${room}/read`), { method: 'POST' });
  assert.equal((await member.request(chat(member, '/summary'))).value.unread, 0);
  assert.equal((await send(admin, room, '   ')).status, 400);
});

test('direct messages are private to their two members, even from the Admin', async () => {
  const [first, second] = [await staff('chat-dm-a'), await staff('chat-dm-b')];
  const opened = await first.request(chat(first, '/direct'), {
    method: 'POST',
    body: { memberId: second.user.id },
  });
  assert.equal(opened.status, 200, JSON.stringify(opened.value));
  const room = opened.value.room.id;
  const again = await second.request(chat(second, '/direct'), {
    method: 'POST',
    body: { memberId: first.user.id },
  });
  assert.equal(again.value.room.id, room, 'one conversation per pair');
  assert.equal((await send(first, room, 'Can you cover my viewing?')).status, 201);
  assert.ok((await rooms(second)).rooms.some((item) => item.id === room));
  assert.ok(!(await rooms(admin)).rooms.some((item) => item.id === room));
  assert.equal((await admin.request(chat(admin, `/rooms/${room}/messages`))).status, 404);
  assert.equal((await send(admin, room, 'Reading this')).status, 404);
  const self = await first.request(chat(first, '/direct'), {
    method: 'POST',
    body: { memberId: first.user.id },
  });
  assert.equal(self.status, 400);
});

test('other companies and the Super Admin read no company chat', async () => {
  const room = (await general(admin)).id;
  const other = await login('admin-b');
  const foreign = await other.request(`/workspaces/${admin.user.workspaceId}/chat`);
  assert.equal(foreign.status, 403);
  assert.equal((await other.request(chat(other, `/rooms/${room}/messages`))).status, 404);
  const owner = await login('owner');
  assert.equal((await owner.request(`/workspaces/${admin.user.workspaceId}/chat`)).status, 403);
});

test('authors edit and delete; the Admin removes channel messages only', async () => {
  const member = await staff('chat-edit');
  const room = (await general(admin)).id;
  const posted = (await send(member, room, 'Viewing at 5')).value.message;
  const item = (session) => chat(session, `/rooms/${room}/messages/${posted.id}`);
  const edited = await member.request(item(member), {
    method: 'PATCH',
    body: { body: 'Viewing at 6' },
  });
  assert.deepEqual(
    [edited.value.message.body, edited.value.message.edited],
    ['Viewing at 6', true],
  );
  const notMine = await admin.request(item(admin), { method: 'PATCH', body: { body: 'x' } });
  assert.equal(notMine.status, 404);
  const removed = await admin.request(item(admin), { method: 'DELETE' });
  assert.deepEqual([removed.value.message.body, removed.value.message.deleted], ['', true]);
});

test('a suspended member loses chat at once', async () => {
  const member = await staff('chat-suspended');
  const record = await findMember(admin, member.user.id);
  await admin.request(teamPath(admin, record.id), {
    method: 'PATCH',
    body: memberUpdate(record, { active: false }),
  });
  assert.ok([401, 403].includes((await member.request(chat(member))).status));
  assert.ok(!(await rooms(admin)).people.some((person) => person.id === member.user.id));
});

test('one member cannot flood chat: 30 messages a minute', async () => {
  const member = await staff('chat-flood');
  const room = (await general(member)).id;
  for (let index = 0; index < 30; index += 1) {
    assert.equal((await send(member, room, `Message ${index}`)).status, 201);
  }
  const blocked = await send(member, room, 'One too many');
  assert.deepEqual([blocked.status, blocked.value.code], [429, 'chat_rate_limited']);
});
