import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query, request } from './helpers.mjs';
import { activate, invite } from './team-helpers.mjs';
import { activityPath, activityTeams, feed } from './activity-helpers.mjs';

let teams;
before(async () => {
  teams = await activityTeams('act-h1');
});

const status = async (session, workspace, params) =>
  (await session.request(activityPath(workspace, params))).status;

test('the check order is session, workspace, permission parameters, then syntax', async () => {
  const { admin, agent, desk, other, teamAgent, workspace } = teams;
  assert.equal((await request(activityPath(workspace))).status, 401);
  const foreign = await admin.request(activityPath(other.user.workspaceId, { limit: '0' }));
  const unknown = await admin.request(activityPath('missing-workspace', { limit: '0' }));
  assert.equal(foreign.status, 403);
  assert.equal(unknown.status, 403);
  assert.equal(JSON.stringify(unknown.value), JSON.stringify(foreign.value));
  for (const [session, params] of [
    [agent, { kind: 'team' }],
    [teamAgent, { kind: 'team' }],
    [agent, { actor: admin.user.id }],
    [agent, { actor: 'not-a-uuid', limit: '0' }],
    [desk, { collection: 'Deals', from: 'not-a-date' }],
    [teamAgent, { collection: 'Payments', cursor: '!!' }],
    [admin, { collection: 'Messages', limit: '0' }],
  ]) {
    assert.equal(await status(session, workspace, params), 403, JSON.stringify(params));
  }
  assert.equal(await status(teamAgent, workspace, { actor: agent.user.id }), 200);
  for (const params of [
    { cursor: 'not-a-cursor' },
    { cursor: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
    { limit: '0' },
    { limit: '101' },
    { limit: 'ten' },
    { from: '2026-10-02', to: '2026-10-01' },
    { from: '2025-01-01', to: '2026-01-02' },
    { from: '2026-02-30' },
    { kind: 'everything' },
    { action: 'emailed' },
    { actor: 'not-a-uuid' },
    { unexpected: '1' },
  ]) {
    const result = await admin.request(activityPath(workspace, params));
    assert.equal(result.status, 400, JSON.stringify(params));
    assert.equal(result.value.code, 'invalid_request');
  }
  for (const limit of ['1', '100']) assert.equal(await status(admin, workspace, { limit }), 200);
  const year = { from: '2025-01-01', to: '2026-01-01' };
  assert.equal(await status(admin, workspace, year), 200);
});

test('a suspended member loses access mid-session', async () => {
  const { admin, workspace } = teams;
  const member = await activate(
    await invite(admin, 'act-h1-suspended', { positions: ['receptionist'] }),
  );
  assert.equal(await status(member, workspace, {}), 200);
  query(`UPDATE crm_users SET active=false WHERE id='${member.user.id}'`);
  assert.ok([401, 403].includes(await status(member, workspace, {})));
});

test('the Super Admin has parity only: the same feed, no merged companies', async () => {
  const { owner, admin, other, workspace } = teams;
  const params = { limit: '100' };
  const asAdmin = await feed(admin, workspace, params);
  const asOwner = await feed(owner, workspace, params);
  assert.deepEqual(asOwner, asAdmin);
  assert.ok(asOwner.activity.some((item) => item.kind === 'team'));
  const ids = new Set([admin.user.id, ...asOwner.activity.map((item) => item.actor.id)]);
  assert.ok(!ids.has(other.user.id));
  const organisation = await feed(owner, owner.user.workspaceId, params);
  const theirs = new Set(asAdmin.activity.map((item) => item.id));
  assert.ok(organisation.activity.every((item) => !theirs.has(item.id)));
});
