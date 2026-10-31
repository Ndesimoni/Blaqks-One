import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { add } from './assignment-helpers.mjs';
import { activityPath, activityTeams, allPages, assertShape, feed } from './activity-helpers.mjs';
import { channelPath, connect, twilioSid, twilioToken } from './channels-helpers.mjs';
import { login } from './helpers.mjs';

const ACCOUNT = twilioSid('0431');
const LABEL = 'Activity studio line';
const SECRET = twilioToken();
const RENEWED = twilioToken();
let teams;
let events;

before(async () => {
  teams = await activityTeams('act-channels');
  const { admin } = teams;
  const made = await connect(admin, {
    externalAccountId: ACCOUNT,
    label: LABEL,
    credential: SECRET,
  });
  assert.equal(made.status, 201, JSON.stringify(made.value));
  const item = channelPath(admin, `/${made.value.connection.id}`);
  const renewed = await admin.request(`${item}/reconnect`, {
    method: 'POST',
    body: { expectedVersion: 1, credential: RENEWED },
  });
  assert.equal(renewed.status, 200, JSON.stringify(renewed.value));
  const gone = await admin.request(item, { method: 'DELETE', body: { expectedVersion: 2 } });
  assert.equal(gone.status, 200, JSON.stringify(gone.value));
  await add(admin, 'Clients', { full_name: 'Channel feed client' });
  events = (await feed(admin, teams.workspace, { kind: 'channel' })).activity;
});

test('the Admin sees redacted channel events newest first', () => {
  assert.deepEqual(
    events.map((item) => item.action),
    ['disconnected', 'reconnected', 'connected'],
  );
  for (const item of events) {
    assert.deepEqual(Object.keys(item).sort(), [
      'action',
      'actor',
      'at',
      'channel',
      'collection',
      'id',
      'kind',
      'member',
      'record',
      'sample',
    ]);
    assert.equal(item.kind, 'channel');
    assert.equal(item.channel, 'whatsapp');
    assert.equal(item.actor.id, teams.admin.user.id);
    assert.equal(item.record, null);
    assert.equal(item.member, null);
    assert.equal(item.collection, null);
  }
  const text = JSON.stringify(events);
  for (const secret of [ACCOUNT, '0431', LABEL, SECRET, RENEWED]) {
    assert.ok(!text.includes(secret), secret);
  }
});

test('the unfiltered feed merges channel, team and record events once each', async () => {
  const { admin, workspace } = teams;
  const all = (await feed(admin, workspace, { limit: '100' })).activity;
  const kinds = new Set(all.map((item) => item.kind));
  assert.deepEqual([...kinds].sort(), ['channel', 'record', 'team']);
  for (const item of all.filter((row) => row.kind !== 'channel'))
    assertShape(item, { manager: true });
  const paged = (await allPages(admin, workspace, { limit: '1' })).flat();
  assert.deepEqual(
    paged.map((item) => item.id),
    all.map((item) => item.id),
  );
});

test('other filters exclude channel events', async () => {
  const { admin, workspace } = teams;
  for (const params of [{ kind: 'record' }, { kind: 'team' }, { collection: 'Clients' }]) {
    const page = await feed(admin, workspace, { ...params, limit: '100' });
    assert.ok(
      page.activity.every((item) => item.kind !== 'channel'),
      JSON.stringify(params),
    );
  }
  const action = await feed(admin, workspace, { action: 'reconnected' });
  assert.deepEqual(
    action.activity.map((item) => item.kind),
    ['channel'],
  );
});

test('staff, the Super Admin and other companies never see channel events', async () => {
  const { agent, teamAgent, workspace } = teams;
  for (const staff of [agent, teamAgent]) {
    const own = await feed(staff, workspace, { limit: '100' });
    assert.ok(own.activity.every((item) => item.kind !== 'channel'));
    const named = await staff.request(activityPath(workspace, { kind: 'channel' }));
    assert.equal(named.status, 403);
  }
  const owner = await login('owner');
  const platform = await feed(owner, workspace, { limit: '100' });
  assert.ok(platform.activity.every((item) => item.kind !== 'channel'));
  assert.equal((await owner.request(activityPath(workspace, { kind: 'channel' }))).status, 403);
  const other = await login('admin-a');
  assert.equal((await other.request(activityPath(workspace, { kind: 'channel' }))).status, 403);
  const theirs = await feed(other, other.user.workspaceId, { kind: 'channel', limit: '100' });
  assert.ok(theirs.activity.every((item) => !events.some((event) => event.id === item.id)));
});
