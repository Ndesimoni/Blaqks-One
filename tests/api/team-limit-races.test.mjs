import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query, request } from './helpers.mjs';
import { newCompany } from './company-helpers.mjs';
import { activate, findMember, invite, memberUpdate, teamPath } from './team-helpers.mjs';
import { changeLimit, rawInvite, seatUsage } from './team-limit-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

const successes = (results) =>
  results.filter((result) => result.status >= 200 && result.status < 300);

test('parallel invitations cannot exceed the default three-seat limit', async () => {
  const { admin } = await newCompany('seat-last-two');
  const results = await Promise.all([
    rawInvite(admin, 'seat-last-two-a'),
    rawInvite(admin, 'seat-last-two-b'),
    rawInvite(admin, 'seat-last-two-c'),
  ]);
  assert.equal(successes(results).length, 2);
  const blocked = results.find((result) => result.status === 409);
  assert.equal(blocked.value.code, 'team_limit_reached');
  assert.equal((await seatUsage(admin)).used, 3);
});

test('an invitation and a reduction to the occupied seats have one winner', async () => {
  const { owner, admin } = await newCompany('seat-invite-race');
  const workspace = admin.user.workspaceId;
  const results = await Promise.all([
    rawInvite(admin, 'seat-invite-race-staff'),
    changeLimit(owner, workspace, 1, 1),
  ]);
  assert.equal(successes(results).length, 1);
  assert.ok(results.some((result) => result.status === 409));
  const usage = await seatUsage(admin);
  assert.ok(usage.used <= usage.limit);
});

test('activation does not double-count the invitation seat during a reduction', async () => {
  const { owner, admin } = await newCompany('seat-activation-race');
  const pending = await invite(admin, 'seat-activation-race-staff');
  const results = await Promise.all([
    request('/auth/invitations/accept', {
      method: 'POST',
      body: { token: pending.invitation.token, password: 'Team123!' },
    }),
    changeLimit(owner, admin.user.workspaceId, 1, 1),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal((await seatUsage(admin)).used, 2);
});

test('restoration and a limit reduction serialize to one valid outcome', async () => {
  const { owner, admin } = await newCompany('seat-restore-race');
  const staff = await activate(await invite(admin, 'seat-restore-race-staff'));
  let member = await findMember(admin, staff.user.id);
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
    admin.request(teamPath(admin, member.id), {
      method: 'PATCH',
      body: memberUpdate(member, { active: true }),
    }),
    changeLimit(owner, admin.user.workspaceId, 1, 1),
  ]);
  assert.equal(successes(results).length, 1);
  const usage = await seatUsage(admin);
  assert.ok(usage.used <= usage.limit);
});
