import test from 'node:test';
import assert from 'node:assert/strict';
import { roomMemberNames } from '../../src/features/server/chat/chatModel.js';

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
