import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query, request } from './helpers.mjs';
import { activate, findMember, invite } from './team-helpers.mjs';
import { archive, archiveReview } from './archive-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('failed archive rolls back account changes, descendants, session revocation and invitation revocation', async () => {
  const owner = await login('owner');
  const invited = await invite(owner, 'archive-rollback-admin', {
    accountRole: 'admin',
    positions: [],
  });
  const admin = await activate(invited);
  const teammate = await invite(admin, 'archive-rollback-staff');
  const staff = await activate(teammate);
  const pending = await invite(admin, 'archive-rollback-invitation');
  const review = await archiveReview(owner, owner, await findMember(owner, admin.user.id));
  query(`CREATE FUNCTION crm_test_reject_archive() RETURNS trigger AS $$
    BEGIN
      IF NEW.action='archived' THEN RAISE EXCEPTION 'Synthetic archive audit failure'; END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER crm_test_reject_archive BEFORE INSERT ON crm_team_activity
    FOR EACH ROW EXECUTE FUNCTION crm_test_reject_archive()`);
  try {
    const result = await archive(owner, owner, review);
    assert.equal(result.status, 503);
    assert.ok(!JSON.stringify(result.value).includes('Synthetic archive audit failure'));
    assert.equal((await admin.request('/auth/session')).status, 200);
    assert.equal((await staff.request('/auth/session')).status, 200);
    assert.equal((await findMember(owner, admin.user.id)).version, review.member.version);
    assert.equal(
      query(
        `SELECT count(*) FROM crm_users WHERE (id='${admin.user.id}' OR owner_id='${admin.user.id}') AND deleted_at IS NOT NULL`,
      ),
      '0',
    );
    assert.equal(
      query(
        `SELECT count(*) FROM crm_team_activity WHERE workspace_id='${admin.user.id}' AND action='archived'`,
      ),
      '0',
    );
    assert.equal(
      (
        await request('/auth/invitations/inspect', {
          method: 'POST',
          body: { token: pending.invitation.token },
        })
      ).status,
      200,
    );
  } finally {
    query(
      'DROP TRIGGER crm_test_reject_archive ON crm_team_activity; DROP FUNCTION crm_test_reject_archive()',
    );
  }
  assert.equal((await archive(owner, owner, review)).status, 200);
});
