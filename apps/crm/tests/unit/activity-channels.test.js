import assert from 'node:assert/strict';
import test from 'node:test';
import { readFilters, requestParams } from '../../src/features/server/activity/activityFilters.js';
import { groupRepeats } from '../../src/features/server/activity/activityGrouping.js';
import { describe } from '../../src/features/server/activity/activityModel.js';
import { actionOptions } from '../../src/features/server/activity/activityVocabulary.js';
import { readActivityPage } from '../../src/features/server/activity/useActivityFeed.js';
import { isConnectedSection } from '../../src/features/server/sectionStatus.js';
import { catalogs } from '../../src/i18n/catalogs/index.js';

const words = catalogs.en.channels;
const t = (key) => words[key.replace(/^channels\./, '')] ?? key;
const ADMIN = '00000000-0000-4000-8000-000000000001';

const channelItem = (overrides = {}) => ({
  id: crypto.randomUUID(),
  at: '2026-10-20T08:00:00.000Z',
  kind: 'channel',
  action: 'connected',
  collection: null,
  actor: { id: ADMIN, name: 'Synthetic Admin' },
  record: null,
  member: null,
  channel: 'whatsapp',
  sample: false,
  ...overrides,
});

test('a channel event reads as the actor, the action and the channel name only', () => {
  const own = describe(channelItem(), { userId: ADMIN, entries: {}, t });
  assert.equal(own.actor, 'You');
  assert.equal(own.verb, 'connected');
  assert.equal(own.object, 'WhatsApp');
  assert.equal(own.section, 'Channels');
  assert.equal(own.tone, 'positive');
  const other = describe(channelItem({ action: 'disconnected', channel: 'tiktok' }), {
    userId: 'someone-else',
    entries: {},
    t,
  });
  assert.equal(other.actor, 'Synthetic Admin');
  assert.equal(other.verb, 'disconnected');
  assert.equal(other.object, 'TikTok');
  assert.equal(other.tone, 'danger');
  for (const action of ['connected', 'reconnected', 'reconnect_required', 'disconnected']) {
    assert.notEqual(t(`channels.activity.verb.${action}`), `channels.activity.verb.${action}`);
  }
});

test('repeats group per channel, never across channels', () => {
  const rows = groupRepeats([
    channelItem({ at: '2026-10-20T08:05:00.000Z' }),
    channelItem({ at: '2026-10-20T08:04:00.000Z' }),
    channelItem({ at: '2026-10-20T08:03:00.000Z', channel: 'tiktok' }),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].items.length, 2);
  assert.equal(rows[1].item.channel, 'tiktok');
});

test('channel filters exist only for the company Admin and never send a section', () => {
  const values = (options) => options.map((option) => option.value);
  assert.deepEqual(values(actionOptions('channel', true, true)), [
    'connected',
    'reconnected',
    'reconnect_required',
    'disconnected',
  ]);
  assert.ok(values(actionOptions('', true, true)).includes('reconnect_required'));
  assert.ok(!values(actionOptions('', true, false)).includes('reconnect_required'));
  assert.ok(!values(actionOptions('', false, true)).includes('connected'));
  assert.equal(readFilters('?type=channel').type, 'channel');
  const params = requestParams(
    { ...readFilters('?type=channel&section=Deals'), section: 'Deals' },
    { manager: true },
    '2026-10-20',
  );
  assert.equal(params.kind, 'channel');
  assert.equal(params.collection, '');
});

test('channel pages load and the Channels section is marked connected', () => {
  const page = readActivityPage({ activity: [channelItem()], nextCursor: null });
  assert.equal(page.rows[0].kind, 'channel');
  const unknown = { activity: [channelItem({ kind: 'other' })], nextCursor: null };
  assert.throws(() => readActivityPage(unknown), /invalid activity/);
  assert.equal(isConnectedSection('Channels'), true);
});
