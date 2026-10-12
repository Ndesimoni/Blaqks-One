import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query, recordsPath, request } from './helpers.mjs';
import { activate, findMember, invite } from './team-helpers.mjs';
import { archive, archiveReview } from './archive-helpers.mjs';
import { holdWorkspaceLock, waitForWorkspaceQueue } from './workspace-lock.mjs';
import { recordCount } from './import-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('deleting a pending Admin revokes its organisation-owned activation link', async () => {
  const owner = await login('owner');
  const pending = await invite(owner, 'archive-pending-admin', {
    accountRole: 'admin',
    positions: [],
  });
  const review = await archiveReview(owner, owner, pending.member);
  assert.equal((await archive(owner, owner, review)).status, 200);
  assert.ok(
    (
      await request('/auth/invitations/accept', {
        method: 'POST',
        body: { token: pending.invitation.token, password: 'Team123!' },
      })
    ).status >= 400,
  );
  assert.equal(
    query(
      `SELECT count(*) FROM crm_team_invitations WHERE user_id='${pending.member.id}' AND revoked_at IS NOT NULL`,
    ),
    '1',
  );
});

test('already authenticated writes queued behind Admin and staff archival are rejected atomically', async () => {
  const owner = await login('owner');
  const invited = await invite(owner, 'archive-race-admin', {
    accountRole: 'admin',
    positions: [],
  });
  const admin = await activate(invited);
  const person = await invite(admin, 'archive-race-staff');
  const staff = await activate(person);
  for (const [actor, scope, member, id] of [
    [staff, admin, await findMember(admin, staff.user.id), 'ARCHIVE-STAFF-RACE'],
    [owner, owner, await findMember(owner, admin.user.id), 'ARCHIVE-ADMIN-RACE'],
  ]) {
    const review = await archiveReview(owner, scope, member);
    const release = await holdWorkspaceLock(admin.user.id);
    let deleting, writing;
    try {
      deleting = archive(owner, scope, review);
      await waitForWorkspaceQueue(1);
      writing = actor.request(recordsPath(admin, 'Clients'), {
        method: 'POST',
        body: { record: { client_id: id } },
      });
      await waitForWorkspaceQueue(2);
    } finally {
      await release();
    }
    assert.equal((await deleting).status, 200);
    assert.equal((await writing).status, 403);
    assert.equal(recordCount(admin.user.id, id), 0);
    assert.equal(
      query(`SELECT count(*) FROM crm_activity WHERE workspace_id='${admin.user.id}'`),
      '0',
    );
  }
});
