import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import { newCompany } from './company-helpers.mjs';
import { activate, inviteExact as invite } from './team-helpers.mjs';
import { changeLimit, limitEvents, seatLimitPath, seatUsage } from './team-limit-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('every company starts with three seats and exposes minimal usage metadata', async () => {
  const { admin } = await newCompany('seat-default');
  assert.deepEqual(await seatUsage(admin), { used: 1, limit: 3, version: 1 });
  assert.equal(
    query(`SELECT account_type||'|'||member_limit FROM crm_company_profiles
      WHERE workspace_id='${admin.user.workspaceId}'`),
    'brokerage|3',
  );
});

test('only the live Super Admin can change a customer company seat limit', async () => {
  const { owner, admin } = await newCompany('seat-access');
  const other = await login('admin-b');
  const staff = await activate(await invite(admin, 'seat-access-staff'));
  const workspace = admin.user.workspaceId;
  for (const caller of [admin, other, staff]) {
    assert.equal((await changeLimit(caller, workspace, 4, 1)).status, 403);
  }
  assert.equal((await changeLimit(owner, 'super-admin-workspace', 4, 1)).status, 403);
  const changed = await changeLimit(owner, workspace, 4, 1);
  assert.deepEqual(changed.value, { used: 2, limit: 4, version: 2 });
  const events = limitEvents(workspace);
  assert.equal(events.length, 1);
  assert.equal(events[0].actor_id, owner.user.id);
  assert.equal(events[0].from_limit, 3);
  assert.equal(events[0].to_limit, 4);
  assert.doesNotMatch(JSON.stringify(events[0]), /email|phone|token|password/i);
});

test('seat-limit writes require mutation controls and a strict bounded body', async () => {
  const { owner, admin } = await newCompany('seat-boundary');
  const workspace = admin.user.workspaceId;
  const path = seatLimitPath(workspace);
  const body = { memberLimit: 4, version: 1 };
  assert.equal((await owner.request(path, { method: 'PUT', body, csrf: undefined })).status, 403);
  assert.equal(
    (
      await owner.request(path, {
        method: 'PUT',
        body,
        headers: { Origin: 'https://foreign.invalid' },
      })
    ).status,
    403,
  );
  for (const invalid of [
    { ...body, extra: true },
    { memberLimit: 0, version: 1 },
    { memberLimit: 10_001, version: 1 },
    { memberLimit: 4, version: 0 },
  ]) {
    assert.equal((await owner.request(path, { method: 'PUT', body: invalid })).status, 400);
  }
  assert.equal((await changeLimit(owner, 'missing-workspace', 4, 1)).status, 403);
});

test('seat-limit versions reject stale writes and unchanged limits create no event', async () => {
  const { owner, admin } = await newCompany('seat-version');
  const workspace = admin.user.workspaceId;
  const unchanged = await changeLimit(owner, workspace, 3, 1);
  assert.deepEqual(unchanged.value, { used: 1, limit: 3, version: 1 });
  assert.equal(limitEvents(workspace).length, 0);
  assert.equal((await changeLimit(owner, workspace, 4, 1)).status, 200);
  const stale = await changeLimit(owner, workspace, 5, 1);
  assert.equal(stale.status, 409);
  assert.equal(stale.value.code, 'conflict');
  assert.deepEqual(await seatUsage(admin), { used: 1, limit: 4, version: 2 });
});
