import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { newCompany, snapshot } from './company-helpers.mjs';
import { findMember, inviteExact as invite, memberUpdate, teamPath } from './team-helpers.mjs';
import { changeLimit, seatUsage } from './team-limit-helpers.mjs';
import { holdWorkspaceLock, waitForWorkspaceQueue } from './workspace-lock.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('renewal and a reduction serialize without oversubscribing the company', async () => {
  const { owner, admin } = await newCompany('seat-renew-race');
  const pending = await invite(admin, 'seat-renew-race-staff');
  let member = await findMember(admin, pending.member.id);
  assert.equal(
    (
      await admin.request(teamPath(admin, member.id), {
        method: 'PATCH',
        body: memberUpdate(member, { active: false }),
      })
    ).status,
    200,
  );
  member = await findMember(admin, member.id);
  const results = await Promise.all([
    admin.request(`${teamPath(admin, member.id)}/invitations`, {
      method: 'POST',
      body: { version: member.version },
    }),
    changeLimit(owner, admin.user.workspaceId, 1, 1),
  ]);
  assert.equal(results.filter((result) => result.status === 200).length, 1);
  const usage = await seatUsage(admin);
  assert.ok(usage.used <= usage.limit);
});

test('a queued limit write rechecks the company owner after suspension', async () => {
  const { owner, admin } = await newCompany('seat-owner-race');
  const workspace = admin.user.workspaceId;
  const before = snapshot(workspace);
  const member = await findMember(owner, admin.user.id);
  const release = await holdWorkspaceLock(workspace);
  let changing;
  try {
    changing = changeLimit(owner, workspace, 4, 1);
    await waitForWorkspaceQueue(1);
    const suspended = await owner.request(teamPath(owner, member.id), {
      method: 'PATCH',
      body: memberUpdate(member, { active: false }),
    });
    assert.equal(suspended.status, 200, JSON.stringify(suspended.value));
  } finally {
    await release();
  }
  assert.equal((await changing).status, 403);
  assert.equal(snapshot(workspace), before);
});
