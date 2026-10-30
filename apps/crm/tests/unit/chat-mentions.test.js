import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groupNames,
  mentionable,
  roomTitle,
  splitRooms,
} from '../../src/features/server/chat/chatModel.js';
import {
  insertMention,
  keptMentions,
  matchMentions,
  mentionParts,
  mentionQuery,
} from '../../src/features/server/chat/mentionModel.js';

const people = [
  { id: 'a', name: 'Sara Haddad' },
  { id: 'b', name: 'Omar Khan' },
  { id: 'c', name: 'Sara Lee' },
];
const t = (key) =>
  ({ 'chat.formerMember': 'Former team member', 'chat.group.untitled': 'Group' })[key];

test('an @ search starts at the start or after a space and stops at a line break', () => {
  assert.deepEqual(mentionQuery('Hi @sa'), { start: 3, query: 'sa' });
  assert.deepEqual(mentionQuery('@'), { start: 0, query: '' });
  assert.deepEqual(mentionQuery('Ask @Sara Ha'), { start: 4, query: 'Sara Ha' });
  assert.equal(mentionQuery('mail me@example.com'), null, 'not inside an address');
  assert.equal(mentionQuery('@ x'), null, 'a space right after @ closes it');
  assert.equal(mentionQuery('@sa\nnext'), null);
  assert.deepEqual(mentionQuery('Hi @sa and more', 6), { start: 3, query: 'sa' }, 'at the caret');
});

test('suggestions match the start of each name word', () => {
  assert.deepEqual(
    matchMentions(people, 'sa').map((person) => person.id),
    ['a', 'c'],
  );
  assert.deepEqual(
    matchMentions(people, 'sara h').map((person) => person.id),
    ['a'],
  );
  assert.deepEqual(
    matchMentions(people, 'kha').map((person) => person.id),
    ['b'],
  );
  assert.equal(matchMentions(people, 'ara').length, 0, 'not the middle of a word');
  assert.equal(matchMentions(people, '').length, 3);
});

test('choosing replaces the search with @Name and keeps only mentions still in the text', () => {
  const chosen = insertMention('Ask @sa please', { start: 4, query: 'sa' }, 'Sara Lee');
  assert.deepEqual(chosen, { text: 'Ask @Sara Lee please', caret: 14 });
  assert.deepEqual(keptMentions(chosen.text, [people[2], people[1]]), ['c']);
  assert.deepEqual(keptMentions('No one', [people[2]]), []);
});

test('mentions are highlighted as text parts, longest names first', () => {
  const named = [
    { id: 'a', name: 'Sara' },
    { id: 'c', name: 'Sara Lee' },
  ];
  assert.deepEqual(mentionParts('Hi @Sara Lee and @Sara!', named), [
    { text: 'Hi ' },
    { text: '@Sara Lee', id: 'c' },
    { text: ' and ' },
    { text: '@Sara', id: 'a' },
    { text: '!' },
  ]);
  assert.deepEqual(mentionParts('<b>@x</b>', []), [{ text: '<b>@x</b>' }]);
  assert.deepEqual(mentionParts('a (b) @S.L', [{ id: 'z', name: 'S.L' }]).at(-1), {
    text: '@S.L',
    id: 'z',
  });
});

test('groups are titled by name or by their members, and mention only members', () => {
  const group = { kind: 'group', title: null, members: ['me', 'a', 'gone'] };
  assert.deepEqual(groupNames(group, people), ['Sara Haddad']);
  assert.equal(roomTitle(group, people, t), 'Sara Haddad');
  assert.equal(roomTitle({ ...group, title: 'Marina' }, people, t), 'Marina');
  assert.equal(roomTitle({ ...group, members: ['me'] }, people, t), 'Group');
  assert.deepEqual(
    mentionable(group, people).map((person) => person.id),
    ['a'],
  );
  assert.equal(mentionable({ kind: 'channel' }, people).length, 3);
  assert.equal(mentionable({ kind: 'direct', peerId: 'a' }, people).length, 0);
  const rooms = [
    { id: 1, kind: 'direct', lastMessageAt: '2026-10-20' },
    { id: 2, kind: 'group', lastMessageAt: '2026-10-21' },
    { id: 3, kind: 'group', lastMessageAt: '2026-10-22' },
    { id: 4, kind: 'channel', name: 'general' },
  ];
  const split = splitRooms(rooms);
  assert.deepEqual(
    [split.channels, split.groups, split.direct].map((list) => list.map((room) => room.id)),
    [[4], [3, 2], [1]],
  );
});
