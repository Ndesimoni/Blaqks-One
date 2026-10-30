import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { login } from './helpers.mjs';
import {
  chatPath,
  general,
  group,
  leave,
  markRead,
  messages,
  roomOf,
  send,
  staff,
  summary,
} from './chat-helpers.mjs';

const admin = await login('admin-a');
const [author, target, bystander] = [
  await staff(admin, 'c3-mention-author'),
  await staff(admin, 'c3-mention-target'),
  await staff(admin, 'c3-mention-bystander'),
];
const mentionsOf = async (session, room) => (await roomOf(session, room)).mentions;
const edit = (session, room, message, body) =>
  session.request(chatPath(session, `/rooms/${room}/messages/${message}`), {
    method: 'PATCH',
    body,
  });

test('a mention in a channel notifies its member until they read the room', async () => {
  const room = (await general(author)).id;
  await markRead(target, room);
  const sent = await send(author, room, '@Synthetic c3-mention-target can you call the seller?', {
    mentions: [target.user.id],
  });
  assert.equal(sent.status, 201, JSON.stringify(sent.value));
  assert.deepEqual(sent.value.message.mentions, [target.user.id]);
  assert.equal(await mentionsOf(target, room), 1);
  assert.equal((await summary(target)).mentions, 1);
  assert.equal((await summary(bystander)).mentions, 0, 'only the mentioned member');
  const listed = (await messages(target, room)).find((item) => item.id === sent.value.message.id);
  assert.deepEqual(listed.mentions, [target.user.id]);
  await markRead(target, room);
  assert.equal((await summary(target)).mentions, 0, 'reading the room clears it');
  const self = await send(author, room, 'Note to @me', { mentions: [author.user.id] });
  assert.equal(self.status, 201);
  assert.equal(await mentionsOf(author, room), 0, 'your own message never notifies you');
});

test('mentions name only members who can see the room', async () => {
  const room = (await group(author, [target, admin], 'Mentions')).id;
  const other = await login('admin-b');
  const foreign = await staff(other, 'c3-mention-foreign');
  const owner = await login('owner');
  const refused = async (room_, mentions, why) => {
    const result = await send(author, room_, 'Hello @someone', { mentions });
    assert.equal(result.status, 400, `${why}: ${JSON.stringify(result.value)}`);
  };
  await refused(room, [bystander.user.id], 'a colleague outside the group');
  await refused(room, [foreign.user.id], 'another company');
  await refused(room, [owner.user.id], 'the Super Admin');
  await refused(room, [randomUUID()], 'a guessed ID');
  await refused(room, [target.user.id, target.user.id], 'the same member twice');
  await refused(
    room,
    Array.from({ length: 21 }, () => randomUUID()),
    'more than 20',
  );
  await refused(room, ['Synthetic'], 'a name instead of an ID');
  const channel = (await general(author)).id;
  await refused(channel, [foreign.user.id], 'another company in a channel');
  const direct = await author.request(chatPath(author, '/direct'), {
    method: 'POST',
    body: { memberId: target.user.id },
  });
  await refused(direct.value.room.id, [target.user.id], 'a direct conversation');
  assert.equal((await messages(target, room)).length, 0, 'refused messages are not sent');
  const ok = await send(author, room, '@Synthetic c3-mention-target and @Fixture Admin A', {
    mentions: [target.user.id, admin.user.id],
  });
  assert.equal(ok.status, 201, JSON.stringify(ok.value));
  assert.equal(await mentionsOf(target, room), 1);
  assert.equal(await mentionsOf(admin, room), 1);
  assert.equal((await leave(target, room)).status, 204);
  assert.equal((await summary(target)).mentions, 0, 'leaving clears their mentions');
  const gone = await send(author, room, 'Still there @Synthetic c3-mention-target?', {
    mentions: [target.user.id],
  });
  assert.equal(gone.status, 400, 'a member who left is no longer mentionable');
});

test('an edit may drop a mention, and a deleted message no longer counts', async () => {
  const room = (await group(author, [target, bystander], 'Edits')).id;
  const first = (
    await send(author, room, 'Ask @Synthetic c3-mention-target', {
      mentions: [target.user.id],
    })
  ).value.message;
  const kept = await edit(author, room, first.id, { body: 'Ask @Synthetic c3-mention-target now' });
  assert.equal(kept.status, 200, JSON.stringify(kept.value));
  assert.deepEqual(kept.value.message.mentions, [target.user.id], 'no mentions key: kept');
  const dropped = await edit(author, room, first.id, { body: 'Ask anyone', mentions: [] });
  assert.deepEqual(dropped.value.message.mentions, []);
  assert.equal(await mentionsOf(target, room), 0);
  const moved = await edit(author, room, first.id, {
    body: 'Ask @Synthetic c3-mention-bystander',
    mentions: [bystander.user.id],
  });
  assert.deepEqual(moved.value.message.mentions, [bystander.user.id]);
  assert.equal(await mentionsOf(bystander, room), 1);
  const outsider = await edit(author, room, first.id, { body: 'x', mentions: [admin.user.id] });
  assert.equal(outsider.status, 400, 'the Admin is not in this group');
  const removed = await author.request(chatPath(author, `/rooms/${room}/messages/${first.id}`), {
    method: 'DELETE',
  });
  assert.equal(removed.status, 200);
  assert.equal(await mentionsOf(bystander, room), 0);
});
