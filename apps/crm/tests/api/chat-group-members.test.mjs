import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { login } from './helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';
import {
  addMembers,
  chatPath,
  group,
  leave,
  messages,
  roomOf,
  send,
  staff,
} from './chat-helpers.mjs';

const admin = await login('admin-b');
const [creator, first, second, outsider] = await Promise.all([
  staff(admin, 'c3-add-creator'),
  staff(admin, 'c3-add-first'),
  staff(admin, 'c3-add-second'),
  staff(admin, 'c3-add-outsider'),
]);
const ids = (...sessions) => sessions.map((session) => session.user.id);

test('the creator adds colleagues who receive full history with no old unread', async () => {
  const room = await group(creator, [first, second], 'Access expansion');
  await send(first, room.id, 'History before joining');
  const added = await addMembers(creator, room.id, ids(outsider));
  assert.equal(added.status, 200, JSON.stringify(added.value));
  assert.deepEqual(added.value.added, ids(outsider));
  const listed = await roomOf(outsider, room.id);
  assert.equal(listed.unread, 0);
  assert.equal(listed.mentions, 0);
  assert.ok(
    (await messages(outsider, room.id)).some((item) => item.body === 'History before joining'),
  );
  await send(first, room.id, 'After joining');
  assert.equal((await roomOf(outsider, room.id)).unread, 1);
});

test('only the group creator re-adds a member; ordinary members and outsiders cannot', async () => {
  const room = await group(creator, [first, second], 'Return path');
  await leave(first, room.id);
  assert.equal(await roomOf(first, room.id), undefined);
  assert.equal((await addMembers(first, room.id, ids(first))).status, 404);
  assert.equal((await addMembers(second, room.id, ids(first))).status, 403);
  assert.equal((await addMembers(creator, room.id, ids(first))).status, 200);
  assert.ok(await roomOf(first, room.id));
  assert.equal((await addMembers(creator, room.id, ids(first))).status, 409);
});

test('a company Admin who is already in a group can add a colleague', async () => {
  const room = await group(creator, [first, admin], 'Participant Admin');
  assert.equal((await addMembers(admin, room.id, ids(outsider))).status, 200);
  assert.ok(await roomOf(outsider, room.id));
});

test('invalid targets and non-group rooms fail without partially expanding access', async () => {
  const room = await group(creator, [first, second], 'Atomic validation');
  const otherAdmin = await login('admin-a');
  const foreign = await staff(otherAdmin, 'c3-add-foreign');
  for (const targets of [
    [randomUUID()],
    ids(outsider, foreign),
    ids(outsider, creator),
    [outsider.user.id, outsider.user.id],
  ]) {
    assert.equal((await addMembers(creator, room.id, targets)).status, 400);
    assert.equal(await roomOf(outsider, room.id), undefined);
  }
  assert.equal((await addMembers(admin, room.id, ids(outsider))).status, 404);
  const general = (await creator.request(chatPath(creator))).value.rooms.find(
    (item) => item.name === 'general',
  );
  assert.equal((await addMembers(creator, general.id, ids(outsider))).status, 400);
});

test('suspended colleagues cannot be added', async () => {
  const departing = await staff(admin, 'c3-add-suspended');
  const record = await findMember(admin, departing.user.id);
  const result = await admin.request(teamPath(admin, record.id), {
    method: 'PATCH',
    body: memberUpdate(record, { active: false }),
  });
  assert.equal(result.status, 200);
  const room = await group(creator, [first, second], 'Live targets only');
  assert.equal((await addMembers(creator, room.id, ids(departing))).status, 400);
});
