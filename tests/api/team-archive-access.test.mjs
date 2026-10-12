import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query, request } from './helpers.mjs';
import { activate, findMember, invite, teamPath } from './team-helpers.mjs';
import { archive, archiveBody, archiveReview } from './archive-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('account archive requires Super Admin, correct scope, current version and email confirmation', async () => {
  const owner = await login('owner');
  const admin = await login();
  const other = await login('admin-b');
  const invitation = await invite(admin, 'archive-authority');
  const staff = await activate(invitation);
  const member = await findMember(admin, staff.user.id);
  const review = await archiveReview(owner, admin, member);
  assert.equal((await request(`${teamPath(admin, member.id)}/archive-preview`)).status, 401);
  for (const actor of [admin, other, staff]) {
    assert.equal((await archive(actor, admin, review)).status, 403);
    assert.equal(
      (await actor.request(`${teamPath(admin, member.id)}/archive-preview`)).status,
      403,
    );
    assert.equal((await actor.request(`${teamPath(admin)}?archived=true`)).status, 403);
  }
  assert.equal((await archive(owner, other, review)).status, 403);
  assert.equal(
    (await archive(owner, admin, review, { confirmationEmail: 'wrong@test.invalid' })).status,
    400,
  );
  assert.equal(
    (await archive(owner, admin, review, { version: review.member.version + 1 })).status,
    409,
  );
  for (const options of [{ csrf: undefined }, { headers: { Origin: 'https://other.invalid' } }]) {
    assert.equal(
      (
        await owner.request(teamPath(admin, member.id), {
          method: 'DELETE',
          body: archiveBody(review),
          ...options,
        })
      ).status,
      403,
    );
  }
  assert.equal((await archive(owner, admin, review, { hardDelete: true })).status, 400);
  assert.equal(
    (
      await owner.request(teamPath(owner, owner.user.id), {
        method: 'DELETE',
        body: archiveBody(review),
      })
    ).status,
    403,
  );
  assert.equal((await findMember(admin, member.id)).active, true);
  const deleted = await archive(owner, admin, review);
  assert.equal(deleted.status, 200, JSON.stringify(deleted.value));
  assert.equal(deleted.value.archived, true);
  assert.equal((await staff.request('/auth/session')).status, 401);
  assert.equal(
    (
      await request('/auth/login', {
        method: 'POST',
        body: { email: invitation.email, password: 'Team123!' },
      })
    ).status,
    401,
  );
});

test('archived staff retain identity and data, disappear from current lists and cannot be restored', async () => {
  const owner = await login('owner');
  const admin = await login();
  const invited = await invite(admin, 'archive-preserved-staff');
  const recordCount = query(
    `SELECT count(*) FROM crm_records WHERE workspace_id='${admin.user.id}'`,
  );
  const member = await findMember(admin, invited.member.id);
  const review = await archiveReview(owner, admin, member);
  assert.equal((await archive(owner, admin, review)).status, 200);
  const current = await admin.request(teamPath(admin));
  assert.ok(!current.value.members.some((item) => item.id === member.id));
  const saved = await owner.request(`${teamPath(admin)}?archived=true`);
  assert.equal(saved.status, 200);
  const archived = saved.value.members.find((item) => item.id === member.id);
  assert.equal(archived.status, 'archived');
  assert.equal(archived.email, invited.email);
  assert.equal(archived.phone, member.phone);
  assert.deepEqual(archived.positions, member.positions);
  assert.equal(
    query(`SELECT count(*) FROM crm_records WHERE workspace_id='${admin.user.id}'`),
    recordCount,
  );
  assert.equal(
    (
      await owner.request(teamPath(admin, member.id), {
        method: 'PATCH',
        body: { version: archived.version, active: true },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await owner.request(`${teamPath(admin, member.id)}/invitations`, {
        method: 'POST',
        body: { version: archived.version },
      })
    ).status,
    403,
  );
  assert.ok(
    (
      await request('/auth/invitations/accept', {
        method: 'POST',
        body: { token: invited.invitation.token, password: 'Team123!' },
      })
    ).status >= 400,
  );
  assert.equal(
    query(
      `SELECT count(*) FROM crm_team_activity WHERE member_id='${member.id}' AND action='archived'`,
    ),
    '1',
  );
});
