import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { request } from './helpers.mjs';
import { refused } from './finance-helpers.mjs';
import { activate, invite } from './team-helpers.mjs';
import { PERFORMANCE_MESSAGES as M, performanceTeams } from './performance-helpers.mjs';
import { targetBody, targetsPath } from './performance-helpers.mjs';

let teams;
before(async () => {
  teams = await performanceTeams('perf-h1');
});

test('reads need the workspace and the reports module before the query', async () => {
  const { admin, other, desk, get, workspace } = teams;
  const anonymous = await request(targetsPath(workspace, '?month=2026-10'));
  assert.equal(anonymous.status, 401);
  refused(await get(desk, 'bad'), 403, M.denied, 'forbidden', 'no reports module');
  refused(await get(other, 'bad'), 403, M.denied, 'forbidden', 'another team');
  refused(await get(admin, 'bad', 'missing-workspace'), 403, M.denied, 'forbidden', 'unknown');
  refused(await admin.request(targetsPath(workspace)), 400, M.month, 'invalid_request');
  for (const month of ['2026-13', '2026-1', '1999-12', '2026-10&extra=1']) {
    refused(await get(admin, month), 400, M.month, 'invalid_request', month);
  }
});

test('writes refuse callers before the body and validate it before the lock', async () => {
  const { owner, admin, other, agent, desk, supervisor, put, workspace } = teams;
  const bad = { surprise: true };
  refused(await put(agent, bad), 403, M.manage, 'forbidden', 'staff');
  refused(await put(supervisor, bad), 403, M.manage, 'forbidden', 'team-scope staff');
  refused(await put(owner, bad), 403, M.manage, 'forbidden', 'Super Admin');
  refused(await put(desk, bad), 403, M.denied, 'forbidden', 'no reports module');
  refused(await put(other, bad), 403, M.denied, 'forbidden', 'another team');
  const noCsrf = await request(targetsPath(workspace), {
    method: 'PUT',
    cookie: admin.cookie,
    body: targetBody(),
  });
  assert.equal(noCsrf.status, 403);
  for (const [changes, message] of [
    [{ month: '2026-00' }, M.month],
    [{ month: null }, M.month],
    [{ metric: 'calls' }, M.metric],
    [{ value: -1 }, M.value],
    [{ value: 2.5 }, M.value],
    [{ value: 1_000_001 }, M.value],
    [{ metric: 'fees', value: 1_000_000_000_001 }, M.value],
    [{ version: 0 }, M.invalid],
    [{ memberId: 'nope' }, M.invalid],
    [{ extra: true }, M.invalid],
  ]) {
    refused(await put(admin, targetBody(changes)), 400, message, 'invalid_request');
  }
  const { version, ...missing } = targetBody();
  assert.equal(version, null);
  refused(await put(admin, missing), 400, M.invalid, 'invalid_request', 'missing key');
});

test('member targets name an active member of this team, with one answer', async () => {
  const { admin, other, put } = teams;
  const foreign = await activate(await invite(other, 'perf-h1-foreign'));
  const unknown = '00000000-0000-4000-8000-000000000001';
  for (const memberId of [foreign.user.id, other.user.id, unknown, teams.owner.user.id]) {
    refused(await put(admin, targetBody({ memberId })), 400, M.member, 'invalid_request');
  }
  const own = await put(admin, targetBody({ memberId: admin.user.id }));
  assert.equal(own.status, 200, JSON.stringify(own.value));
  assert.equal(own.value.target.memberId, admin.user.id);
});
