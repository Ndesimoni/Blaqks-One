import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ageLabel,
  canReplyOn,
  channelHealth,
  initials,
  listParams,
  searchRows,
  statusKey,
  threadGroups,
} from '../../src/features/server/inbox/inboxModel.js';

const row = (overrides = {}) => ({
  id: 'c1',
  contact: { display: '+971500000001', name: null },
  match: 'unknown',
  state: 'new',
  suggestedLead: false,
  preview: 'Is the villa available?',
  ...overrides,
});

test('tabs map to the API filters and never mix spam into working tabs', () => {
  assert.deepEqual(listParams('mine'), { assignee: 'me', state: 'active' });
  assert.deepEqual(listParams('unassigned', { channel: 'tiktok' }), {
    assignee: 'unassigned',
    state: 'active',
    channel: 'tiktok',
  });
  assert.deepEqual(listParams('team', { state: 'resolved' }), { state: 'resolved' });
  assert.deepEqual(listParams('spam', { state: 'open' }), { state: 'spam' });
});

test('rows read as the design asks: names, unknown senders and status lines', () => {
  assert.equal(initials(row()), '?');
  assert.equal(initials(row({ match: 'linked', contact: { name: 'Layla  Haddad' } })), 'LH');
  assert.equal(statusKey(row({ suggestedLead: true })), 'inbox.status.suggested');
  assert.equal(statusKey(row()), 'inbox.status.newContact');
  assert.equal(statusKey(row({ match: 'choice' })), 'inbox.status.choice');
  assert.equal(
    statusKey(row({ match: 'linked', linked: { collection: 'Clients' } })),
    'inbox.status.client',
  );
  assert.equal(statusKey(row({ state: 'spam' })), 'inbox.status.blocked');
});

test('search keeps rows matching every word in name, address or message', () => {
  const rows = [
    row(),
    row({
      id: 'c2',
      contact: { name: 'Omar Siddiqui', display: 'o@example.test' },
      preview: 'Offer',
    }),
  ];
  assert.deepEqual(
    searchRows(rows, 'omar offer').map((r) => r.id),
    ['c2'],
  );
  assert.deepEqual(
    searchRows(rows, ' VILLA ').map((r) => r.id),
    ['c1'],
  );
  assert.equal(searchRows(rows, '').length, 2);
});

test('ages are relative and days follow Dubai time', () => {
  const now = new Date('2026-10-20T10:00:00Z');
  assert.deepEqual(ageLabel('2026-10-20T09:58:00Z', now), {
    key: 'inbox.age.minutes',
    vars: { count: 2 },
  });
  assert.deepEqual(ageLabel('2026-10-20T06:00:00Z', now), {
    key: 'inbox.age.hours',
    vars: { count: 4 },
  });
  assert.deepEqual(ageLabel('2026-10-19T08:00:00Z', now), { key: 'inbox.age.yesterday' });
  assert.equal(ageLabel('2026-10-10T08:00:00Z', now).key, 'inbox.age.date');
});

test('notes interleave with messages by time and stay notes', () => {
  const groups = threadGroups(
    [
      { id: 'm1', at: '2026-10-20T05:00:00.000Z' },
      { id: 'm2', at: '2026-10-20T07:00:00.000Z' },
    ],
    [{ id: 'n1', at: '2026-10-20T06:00:00.000Z' }],
  );
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0].items.map((item) => [item.id, item.kind]),
    [
      ['m1', 'message'],
      ['n1', 'note'],
      ['m2', 'message'],
    ],
  );
});

test('channel health and reply permission follow the summary and account grants', () => {
  const channels = [
    { channel: 'whatsapp', state: 'connected' },
    { channel: 'email', state: 'reconnect_required' },
  ];
  assert.equal(channelHealth(channels, 'whatsapp'), 'connected');
  assert.equal(channelHealth(channels, 'email'), 'attention');
  assert.equal(channelHealth(channels, 'tiktok'), 'off');
  assert.equal(
    canReplyOn({ roleId: 'staff', channelAccess: { whatsapp: true } }, 'whatsapp'),
    true,
  );
  assert.equal(canReplyOn({ roleId: 'staff', channelAccess: { whatsapp: true } }, 'email'), false);
  assert.equal(canReplyOn({ roleId: 'staff', channelAccess: {} }, 'instagram'), false);
  assert.equal(canReplyOn({ roleId: 'admin' }, 'instagram'), true);
});
