import test from 'node:test';
import assert from 'node:assert/strict';
import { previewLine, roomMemberNames } from '../../src/features/server/chat/chatModel.js';

const people = [
  { id: 'a', name: 'Aidah' },
  { id: 'b', name: 'Reem' },
  { id: 'c', name: 'Simoni' },
];

test('the Members pane lists everyone in a channel, a group’s members and the peer', () => {
  assert.deepEqual(roomMemberNames({ kind: 'channel' }, people), ['Aidah', 'Reem', 'Simoni']);
  assert.deepEqual(roomMemberNames({ kind: 'group', members: ['c', 'gone', 'a'] }, people), [
    'Simoni',
    'Aidah',
  ]);
  assert.deepEqual(roomMemberNames({ kind: 'direct', peerId: 'b' }, people), ['Reem']);
  assert.deepEqual(roomMemberNames({ kind: 'direct' }, people), []);
  assert.deepEqual(roomMemberNames({ kind: 'group' }), []);
});

test('a room row names who wrote the latest message, except the peer in a direct chat', () => {
  const t = (key, vars) => `${key} ${JSON.stringify(vars)}`;
  const room = (kind, authorId) => ({ kind, lastMessage: { body: 'See you at 4', authorId } });
  assert.equal(previewLine({ kind: 'channel' }, people, 'me', t), '');
  assert.equal(
    previewLine(room('channel', 'me'), people, 'me', t),
    'chat.preview.you {"body":"See you at 4"}',
  );
  assert.equal(
    previewLine(room('group', 'b'), people, 'me', t),
    'chat.preview.by {"name":"Reem","body":"See you at 4"}',
  );
  assert.equal(previewLine(room('direct', 'b'), people, 'me', t), 'See you at 4');
  assert.match(previewLine(room('channel', 'gone'), people, 'me', t), /chat\.formerMember/);
});
