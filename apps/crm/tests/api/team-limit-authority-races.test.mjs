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
  let suspending, changing;
  try {
    // Suspending an Admin also takes their company lock, after the organisation's (WhatsApp
    // design W-M1), so the suspension queues first and the limit write behind it.
    suspending = owner.request(teamPath(owner, member.id), {
      method: 'PATCH',
      body: memberUpdate(member, { active: false }),
    });
    await waitForWorkspaceQueue(1);
    changing = changeLimit(owner, workspace, 4, 1);
    await waitForWorkspaceQueue(2);
  } finally {
    await release();
  }
  const suspended = await suspending;
  assert.equal(suspended.status, 200, JSON.stringify(suspended.value));
  assert.equal((await changing).status, 403);
  assert.equal(snapshot(workspace), before);
});
