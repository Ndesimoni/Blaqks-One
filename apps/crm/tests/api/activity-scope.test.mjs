import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { add, assign, remove } from './assignment-helpers.mjs';
import { targetBody, targetsPath } from './performance-helpers.mjs';
import {
  activityPath,
  activityTeams,
  assertShape,
  clientWithDeal,
  feed,
} from './activity-helpers.mjs';

let teams;
let deal;
before(async () => {
  teams = await activityTeams('act-scope');
  deal = await clientWithDeal(teams.agent, teams.admin);
});

const rowFor = (activity, id) => activity.find((item) => item.record?.id === id);

test('assigned staff read only their own actions, and lost records become unavailable', async () => {
  const { admin, agent, second, workspace } = teams;
  const kept = await add(agent, 'Clients', { full_name: 'Scope kept' });
  const moved = await add(agent, 'Clients', { full_name: 'Scope moved' });
  const gone = await add(agent, 'Clients', { full_name: 'Scope deleted' });
  await add(admin, 'Clients', { full_name: 'Scope admin client' });
  const before = await feed(agent, workspace, { limit: '100' });
  for (const item of before.activity) assertShape(item, { manager: false });
  assert.ok(before.activity.every((item) => item.actor.id === agent.user.id));
  assert.ok(before.activity.every((item) => item.kind === 'record'));
  assert.ok(rowFor(before.activity, moved.id));
  const reassigned = await assign(admin, 'Clients', moved, second.user.id);
  assert.equal(reassigned.status, 200, JSON.stringify(reassigned.value));
  assert.equal((await remove(admin, 'Clients', gone.id, gone.version)).status, 200);
  const after = await feed(agent, workspace, { limit: '100' });
  assert.equal(after.activity.length, before.activity.length);
  assert.ok(rowFor(after.activity, kept.id));
  const text = JSON.stringify(after);
  for (const hidden of [moved.id, gone.id, moved.record.client_id, gone.record.client_id]) {
    assert.ok(!text.includes(hidden), hidden);
  }
  const unavailable = after.activity.filter((item) => item.record === null);
  assert.equal(unavailable.length, 2);
  // The explicit own-actor filter gives the same rows.
  const own = await feed(agent, workspace, { actor: agent.user.id, limit: '100' });
  assert.deepEqual(own, after);
});

test('finance rows follow the finance module and team finance needs teamView', async () => {
  const { agent, desk, teamAgent, viewer, workspace } = teams;
  const ownView = await feed(agent, workspace, { collection: 'Deals' });
  assert.deepEqual(rowFor(ownView.activity, deal.id).record, {
    id: deal.id,
    legacyId: deal.dealId,
  });
  const team = await feed(viewer, workspace, { collection: 'Deals', limit: '100' });
  const seen = rowFor(team.activity, deal.id);
  assert.equal(seen.actor.id, agent.user.id);
  const scoped = await feed(teamAgent, workspace, { limit: '100' });
  assert.ok(
    scoped.activity.every((item) => !['Deals', 'Payments', 'Expenses'].includes(item.collection)),
  );
  assert.ok(scoped.activity.some((item) => item.actor.id === agent.user.id));
  for (const [session, collection] of [
    [teamAgent, 'Deals'],
    [desk, 'Payments'],
    [desk, 'Targets'],
  ]) {
    const refused = await session.request(activityPath(workspace, { collection }));
    assert.equal(refused.status, 403, `${collection}`);
  }
  const deskFeed = await feed(desk, workspace, { limit: '100' });
  assert.ok(deskFeed.activity.every((item) => item.collection !== 'Deals'));
  for (const body of [team, scoped, ownView]) {
    const text = JSON.stringify(body);
    assert.ok(!text.includes('245000000') && !text.includes('Synthetic deal'));
  }
});

test('Targets rows need reports and name the target only when it is visible now', async () => {
  const { admin, desk, teamAgent, viewer, workspace } = teams;
  const save = async (metric) => {
    const result = await admin.request(targetsPath(workspace), {
      method: 'PUT',
      body: targetBody({ metric, value: metric === 'fees' ? 5_000_000 : 12 }),
    });
    assert.equal(result.status, 200, JSON.stringify(result.value));
    return result.value.target;
  };
  const viewings = await save('viewings');
  const fees = await save('fees');
  const read = async (session) =>
    (await feed(session, workspace, { collection: 'Targets', limit: '100' })).activity;
  const forViewer = await read(viewer);
  assert.deepEqual(rowFor(forViewer, viewings.id).record, { id: viewings.id, legacyId: null });
  assert.ok(rowFor(forViewer, fees.id));
  const forTeamAgent = await read(teamAgent);
  assert.equal(forTeamAgent.length, 2);
  assert.ok(rowFor(forTeamAgent, viewings.id));
  assert.equal(rowFor(forTeamAgent, fees.id), undefined);
  assert.ok(!JSON.stringify(forTeamAgent).includes(fees.id));
  assert.ok(!JSON.stringify(forViewer).includes('5000000'));
  const deskFeed = await feed(desk, workspace, { limit: '100' });
  assert.ok(deskFeed.activity.every((item) => item.collection !== 'Targets'));
});
