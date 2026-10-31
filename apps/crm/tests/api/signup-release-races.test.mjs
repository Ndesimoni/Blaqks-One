import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import { codeFor, details, email, resetSignup, started, verify } from './signup-helpers.mjs';

before(resetSignup);

test('abandoned Admin release serializes with invitation renewal', async () => {
  const owner = await login('owner');
  const address = email('release-renewal');
  const invitation = await owner.request('/workspaces/super-admin-workspace/team/invitations', {
    method: 'POST',
    body: {
      name: 'Synthetic Renewal Race',
      email: address,
      phone: '+971501234567',
      positions: [],
      accountRole: 'admin',
    },
  });
  assert.equal(invitation.status, 201, JSON.stringify(invitation.value));
  const member = invitation.value.member;
  query(
    `UPDATE crm_team_invitations SET revoked_at=now() WHERE user_id='${member.id}'; ` +
      `UPDATE crm_users SET version=version+1 WHERE id='${member.id}'`,
  );
  const pending = await started(details({ email: address }));
  const version = query(`SELECT version FROM crm_users WHERE id='${member.id}'`);
  const [signup, renewal] = await Promise.all([
    verify(pending.ticket, codeFor(pending.ticket)),
    owner.request(`/workspaces/super-admin-workspace/team/${member.id}/invitations`, {
      method: 'POST',
      body: { version: Number(version) },
    }),
  ]);
  const signupWon = signup.status === 201 && [403, 409].includes(renewal.status);
  const renewalWon = signup.status === 409 && renewal.status === 200;
  assert.ok(signupWon || renewalWon, JSON.stringify({ signup, renewal }));
  assert.equal(query(`SELECT count(*) FROM crm_users WHERE email='${address}'`), '1');
});
