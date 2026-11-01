import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stripItems,
  stripLabel,
} from '../../src/features/server/products/messenger/chatStripModel.js';

const t = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);
const rows = [
  { id: 'c1', match: 'linked', contact: { name: 'Layla Haddad' }, unread: true },
  { id: 'c2', match: 'unknown', contact: { display: '+971 55 000 0000' }, unread: false },
  { id: 'c3', match: 'linked', contact: { name: 'Omar Farouk' } },
  { id: 'c4', match: 'linked', contact: { name: 'Not shown' } },
];
const rooms = [
  { id: 'r1', kind: 'channel', name: 'general', unread: 3, lastMessageAt: '2026-11-01T08:00:00Z' },
  { id: 'r2', kind: 'direct', peerId: 'm2', unread: 0, lastMessageAt: '2026-11-01T09:00:00Z' },
];
const people = [{ id: 'm2', name: 'Simoni Agent' }];

test('the strip lists three inbox conversations, then the newest rooms', () => {
  const items = stripItems(rows, rooms, people, t);
  assert.deepEqual(
    items.map((item) => [item.box, item.id, item.name, item.initials, item.unread]),
    [
      ['inbox', 'c1', 'Layla Haddad', 'LH', 1],
      ['inbox', 'c2', '+971 55 000 0000', '?', 0],
      ['inbox', 'c3', 'Omar Farouk', 'OF', 0],
      ['team', 'r2', 'Simoni Agent', 'SA', 0],
      ['team', 'r1', '#general', 'G', 3],
    ],
  );
  assert.deepEqual(stripItems(undefined, undefined, undefined, t), []);
});

test('each avatar is named with its box and what is unread', () => {
  const [layla, unknown] = stripItems(rows, rooms, people, t);
  const general = stripItems([], rooms, people, t).find((item) => item.id === 'r1');
  assert.equal(stripLabel(layla, t), 'messenger.stripInboxUnread {"name":"Layla Haddad"}');
  assert.equal(stripLabel(unknown, t), 'messenger.stripInbox {"name":"+971 55 000 0000"}');
  assert.equal(stripLabel(general, t), 'messenger.stripTeamUnread {"name":"#general","count":3}');
});
