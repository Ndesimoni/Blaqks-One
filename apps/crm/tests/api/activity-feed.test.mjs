import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create } from './helpers.mjs';
import { activate, invite } from './team-helpers.mjs';
import {
  activityTeams,
  allPages,
  assertShape,
  burst,
  clientWithDeal,
  feed,
} from './activity-helpers.mjs';

let teams;
before(async () => {
  teams = await activityTeams('act-feed');
});

test('an Admin sees record and team events with redacted items', async () => {
  const { admin, agent, workspace } = teams;
  const client = await create(admin, 'Clients', { full_name: 'Feed private name' });
  const deal = await clientWithDeal(agent, admin);
  const { activity, nextCursor } = await feed(admin, workspace, { limit: '100' });
  assert.equal(nextCursor, null);
  for (const item of activity) assertShape(item, { manager: true });
  const created = activity.find((item) => item.record?.id === client.id);
  assert.equal(created.action, 'created');
  assert.equal(created.collection, 'Clients');
  assert.equal(created.record.legacyId, client.record.client_id);
  assert.equal(created.actor.id, admin.user.id);
  const dealRow = activity.find((item) => item.collection === 'Deals');
  assert.deepEqual(dealRow.record, { id: deal.id, legacyId: deal.dealId });
  assert.equal(dealRow.actor.id, agent.user.id);
  const invited = activity.filter((item) => item.kind === 'team' && item.action === 'invited');
  assert.ok(invited.some((item) => item.member.id === agent.user.id));
  const text = JSON.stringify(activity);
  for (const secret of ['Feed private name', 'Synthetic deal', '245000000', 'fils', 'reason']) {
    assert.ok(!text.includes(secret), secret);
  }
  // Newest first, ties broken by id.
  const keys = activity.map((item) => `${item.at}|${item.id}`);
  assert.deepEqual(keys, [...keys].sort().reverse());
});

test('filters narrow by kind, collection, action and actor', async () => {
  const { admin, agent, workspace } = teams;
  const teamOnly = await feed(admin, workspace, { kind: 'team' });
  assert.ok(teamOnly.activity.length > 0);
  assert.ok(teamOnly.activity.every((item) => item.kind === 'team'));
  const records = await feed(admin, workspace, { kind: 'record', collection: 'Deals' });
  assert.ok(records.activity.every((item) => item.collection === 'Deals'));
  const invited = await feed(admin, workspace, { action: 'invited' });
  assert.ok(invited.activity.every((item) => item.action === 'invited'));
  const byAgent = await feed(admin, workspace, { actor: agent.user.id });
  assert.ok(byAgent.activity.length > 0);
  assert.ok(byAgent.activity.every((item) => item.actor.id === agent.user.id));
  const stranger = await feed(admin, workspace, { actor: teams.other.user.id });
  assert.deepEqual(stranger, { activity: [], nextCursor: null });
  const unknown = await feed(admin, workspace, { actor: '00000000-0000-4000-8000-00000000abcd' });
  assert.deepEqual(unknown, { activity: [], nextCursor: null });
});

test('pages are stable across cursors, including rows with one timestamp', async () => {
  const { admin, workspace } = teams;
  const client = await create(admin, 'Clients', { full_name: 'Burst client' });
  burst(workspace, admin.user.id, client.id, 7);
  const range = { from: '2026-01-15', to: '2026-01-15', limit: '3' };
  const pages = await allPages(admin, workspace, range);
  assert.deepEqual(
    pages.map((page) => page.length),
    [3, 3, 1],
  );
  const ids = pages.flat().map((item) => item.id);
  assert.equal(new Set(ids).size, 7);
  assert.deepEqual(ids, [...ids].sort().reverse());
  const exact = await feed(admin, workspace, { ...range, limit: '7' });
  assert.equal(exact.nextCursor, null);
  assert.deepEqual(
    exact.activity.map((item) => item.id),
    ids,
  );
  // A cursor carries no workspace: replayed elsewhere it only bounds that workspace.
  const first = await feed(admin, workspace, range);
  const other = teams.other;
  const elsewhere = await feed(other, other.user.workspaceId, {
    ...range,
    cursor: first.nextCursor,
  });
  assert.deepEqual(elsewhere.activity, []);
});

test('the default window is the last 90 Dubai days', async () => {
  const { admin, workspace } = teams;
  const { activity } = await feed(admin, workspace, { limit: '100' });
  assert.ok(activity.every((item) => !item.at.startsWith('2026-01-15')));
  const staff = await activate(
    await invite(admin, 'act-feed-late', { positions: ['receptionist'] }),
  );
  const latest = await feed(admin, workspace, { kind: 'team', limit: '1' });
  assert.equal(latest.activity[0].member.id, staff.user.id);
  assert.ok(latest.nextCursor);
});
