import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query, request } from './helpers.mjs';
import { findMember, invite, memberUpdate, teamPath } from './team-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('expired and revoked invitations cannot activate an account', async () => {
  const owner = await login();
  for (const state of ['expired', 'revoked']) {
    const invited = await invite(owner, `${state}-invitation`);
    query(
      `UPDATE crm_team_invitations SET ${state === 'expired' ? "expires_at=now()-interval '1 second'" : 'revoked_at=now()'} WHERE user_id='${invited.member.id}'`,
    );
    for (const action of ['inspect', 'accept']) {
      const result = await request(`/auth/invitations/${action}`, {
        method: 'POST',
        body: {
          token: invited.invitation.token,
          ...(action === 'accept' ? { password: 'Team123!' } : {}),
        },
      });
      assert.ok([400, 404, 409, 410].includes(result.status), JSON.stringify(result.value));
    }
    assert.equal(query(`SELECT active FROM crm_users WHERE id='${invited.member.id}'`), 'f');
  }
});

test('pending accounts cannot be activated through member editing or an inactive owner', async () => {
  const owner = await login('admin-b');
  const invited = await invite(owner, 'pending-boundary');
  const member = await findMember(owner, invited.member.id);
  const edit = await owner.request(teamPath(owner, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { active: true }),
  });
  assert.ok([400, 409].includes(edit.status), JSON.stringify(edit.value));
  try {
    query(`UPDATE crm_users SET active=false WHERE id='${owner.user.id}'`);
    const result = await request('/auth/invitations/accept', {
      method: 'POST',
      body: { token: invited.invitation.token, password: 'Team123!' },
    });
    assert.ok([400, 403, 404, 409, 410].includes(result.status));
    assert.equal(query(`SELECT active FROM crm_users WHERE id='${invited.member.id}'`), 'f');
  } finally {
    query(`UPDATE crm_users SET active=true WHERE id='${owner.user.id}'`);
  }
});

test('invitation secrets are hashed and team audit remains redacted and immutable', async () => {
  const owner = await login();
  const invited = await invite(owner, 'secret-boundary');
  const stored = query(
    `SELECT token_hash FROM crm_team_invitations WHERE user_id='${invited.member.id}'`,
  );
  assert.match(stored, /^[a-f0-9]{64}$/);
  assert.notEqual(stored, invited.invitation.token);
  const audit = JSON.parse(
    query(
      `SELECT row_to_json(a) FROM crm_team_activity a WHERE member_id='${invited.member.id}' ORDER BY created_at LIMIT 1`,
    ),
  );
  assert.equal(audit.actor_id, owner.user.id);
  assert.equal(audit.workspace_id, owner.user.id);
  const raw = JSON.stringify(audit);
  for (const secret of [invited.email, invited.invitation.token, 'Team123!']) {
    assert.ok(!raw.includes(secret));
  }
  assert.throws(() => query(`UPDATE crm_team_activity SET action=action WHERE id='${audit.id}'`));
});
