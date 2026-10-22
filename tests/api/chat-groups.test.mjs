import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { login } from './helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';
import {
  chatPath,
  group,
  leave,
  markRead,
  messages,
  roomOf,
  rooms,
  send,
  staff,
  startGroup,
  summary,
} from './chat-helpers.mjs';

const admin = await login('admin-a');
const [first, second, third] = [
  await staff(admin, 'c3-group-a'),
  await staff(admin, 'c3-group-b'),
  await staff(admin, 'c3-group-c'),
];
const ids = (...sessions) => sessions.map((session) => session.user.id);

test('a group has the creator and 2–20 distinct colleagues of the same company', async () => {
  const refused = async (memberIds, name) => {
    const result = await startGroup(first, memberIds, name);
    assert.equal(result.status, 400, JSON.stringify(result.value));
  };
  await refused(ids(second));
  await refused(Array.from({ length: 21 }, () => randomUUID()));
  await refused([...ids(second), ...ids(second)]);
  await refused(ids(first, second));
  await refused(['not-an-id', ...ids(second)]);
  await refused(ids(second, third), 'x'.repeat(61));
  const other = await login('admin-b');
  const foreign = await staff(other, 'c3-group-foreign');
  await refused(ids(second, foreign));
  const owner = await login('owner');
  await refused([...ids(second), owner.user.id]);
  const extra = await first.request(chatPath(first, '/groups'), {
    method: 'POST',
    body: { memberIds: ids(second, third), name: 'Team', topic: 'x' },
  });
  assert.equal(extra.status, 400);
  const room = await group(first, [second, third], '  Marina viewings ');
  assert.equal(room.kind, 'group');
  assert.equal(room.title, 'Marina viewings');
  assert.deepEqual([...room.members].sort(), ids(first, second, third).sort());
  const plain = await group(first, [second, admin]);
  assert.equal(plain.title, null, 'no name: the screen shows the members');
  const listed = await roomOf(third, room.id);
  assert.equal(listed.title, 'Marina viewings');
  assert.equal(listed.members.length, 3);
});

test('only participants read and post; the Admin outside it gets not-found', async () => {
  const room = (await group(first, [second, third], 'Weekend cover')).id;
  const posted = await send(second, room, 'I can take Saturday.');
  assert.equal(posted.status, 201, JSON.stringify(posted.value));
  assert.ok((await messages(third, room)).some((item) => item.body === 'I can take Saturday.'));
  assert.equal((await roomOf(third, room)).unread, 1);
  assert.ok((await summary(third)).unread >= 1);
  await markRead(third, room);
  assert.equal((await roomOf(third, room)).unread, 0);
  assert.equal(await roomOf(admin, room), undefined, 'the Admin does not see it');
  const as = (session, suffix = '') => chatPath(session, `/rooms/${room}${suffix}`);
  assert.equal((await admin.request(as(admin, '/messages'))).status, 404);
  assert.equal((await send(admin, room, 'Reading this')).status, 404);
  assert.equal((await markRead(admin, room)).status, 404);
  assert.equal((await leave(admin, room)).status, 404);
  const other = await login('admin-b');
  assert.equal((await other.request(as(other, '/messages'))).status, 404);
  const cross = await other.request(`/workspaces/${admin.user.workspaceId}/chat`);
  assert.equal(cross.status, 403);
  const owner = await login('owner');
  const watched = await owner.request(
    `/workspaces/${admin.user.workspaceId}/chat/rooms/${room}/messages`,
  );
  assert.equal(watched.status, 403, 'the Super Admin reads no company chat');
  const guessed = chatPath(first, `/rooms/${randomUUID()}/messages`);
  assert.equal((await first.request(guessed)).status, 404);
  const outsider = await staff(admin, 'c3-group-outsider');
  assert.equal((await send(outsider, room, 'Hello?')).status, 404);
});

test('a participant leaves a group; the others keep it', async () => {
  const room = (await group(first, [second, third], 'Leaving test')).id;
  assert.equal((await send(third, room, 'Bye for now.')).status, 201);
  const left = await leave(third, room);
  assert.equal(left.status, 204);
  assert.equal(await roomOf(third, room), undefined);
  assert.equal((await third.request(chatPath(third, `/rooms/${room}/messages`))).status, 404);
  assert.equal((await send(third, room, 'Back again')).status, 404);
  const kept = await roomOf(first, room);
  assert.deepEqual([...kept.members].sort(), ids(first, second).sort());
  assert.ok((await messages(first, room)).some((item) => item.body === 'Bye for now.'));
  const general = (await rooms(first)).rooms.find((item) => item.name === 'general');
  assert.equal((await leave(first, general.id)).status, 400, 'channels cannot be left');
  const direct = await first.request(chatPath(first, '/direct'), {
    method: 'POST',
    body: { memberId: second.user.id },
  });
  assert.equal((await leave(first, direct.value.room.id)).status, 400);
});

test('a colleague who leaves the company stays listed and loses the group', async () => {
  const departing = await staff(admin, 'c3-group-departing');
  const room = (await group(first, [second, departing], 'Departure')).id;
  const record = await findMember(admin, departing.user.id);
  const suspended = await admin.request(teamPath(admin, record.id), {
    method: 'PATCH',
    body: memberUpdate(record, { active: false }),
  });
  assert.equal(suspended.status, 200, JSON.stringify(suspended.value));
  assert.ok((await roomOf(first, room)).members.includes(departing.user.id));
  assert.ok([401, 403].includes((await departing.request(chatPath(departing))).status));
  assert.equal((await send(first, room, 'Still here.')).status, 201);
  const later = await startGroup(first, ids(second, departing));
  assert.equal(later.status, 400, 'a departed colleague cannot be added to a new group');
});
