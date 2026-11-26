import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import { activate, findMember, invite, teamPath } from './team-helpers.mjs';
import { archive, archiveReview } from './archive-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('team changes invalidate the deletion review and concurrent archive requests have one winner', async () => {
  const owner = await login('owner');
  const invitation = await invite(owner, 'archive-review-admin', {
    accountRole: 'admin',
    positions: [],
  });
  const admin = await activate(invitation);
  const member = await findMember(owner, admin.user.id);
  const stale = await archiveReview(owner, owner, member);
  const staff = await invite(admin, 'archive-new-team-member');
  assert.equal((await archive(owner, owner, stale)).status, 409);
  assert.equal((await admin.request('/auth/session')).status, 200);
  const review = await archiveReview(owner, owner, member);
  assert.equal(review.teamCount, 1);
  const responses = await Promise.all([
    archive(owner, owner, review),
    archive(owner, owner, review),
  ]);
  assert.equal(responses.filter((result) => result.status === 200).length, 1);
  assert.ok(responses.every((result) => [200, 403, 409].includes(result.status)));
  assert.equal(
    query(
      `SELECT count(*) FROM crm_team_activity WHERE member_id='${staff.member.id}' AND action='archived'`,
    ),
    '1',
  );
  assert.equal(
    (
      await owner.request(teamPath(owner, member.id), {
        method: 'PATCH',
        body: { version: review.member.version + 1, active: true },
      })
    ).status,
    403,
  );
});
