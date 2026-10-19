import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query, request } from './helpers.mjs';
import {
  details,
  email,
  invitationFixture,
  resetSignup,
  started,
  verify,
} from './signup-helpers.mjs';

before(resetSignup);

test('verification creates one universal Free-company Admin', async () => {
    const pending = await started(details({ email: email('universal-company') }));
    const consentedAt = query(
      `SELECT consented_at::text FROM crm_signup_requests WHERE email='${pending.body.email}'`,
    );
    const response = await verify(pending.ticket);
    assert.equal(response.status, 201, JSON.stringify(response.value));
    assert.equal(response.value.user.roleId, 'admin');
    assert.equal(response.value.user.email, pending.body.email);
    assert.equal(response.value.user.phoneVerified, false);
    assert.equal(response.value.company.accountType, 'brokerage');
    assert.equal(response.value.company.memberLimit, 3);
    assert.ok(response.value.csrfToken);
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly; SameSite=Strict; Max-Age=28800/);
    const current = await request('/auth/session', {
      cookie: cookie.split(';')[0],
    });
    assert.equal(current.status, 200);
    assert.equal(current.value.user.id, response.value.user.id);
    const user = response.value.user.id;
    assert.equal(
      query(
        `SELECT (email_verified_at IS NOT NULL)::int||'|'||` +
          `(phone_verified_at IS NULL)::int||'|'||role||'|'||` +
          `(owner_id IS NULL)::int FROM crm_users WHERE id='${user}'`,
      ),
      '1|1|admin|1',
    );
    assert.equal(query(`SELECT count(*) FROM crm_account_consents WHERE user_id='${user}'`), '2');
    assert.equal(
      query(
        `SELECT count(*) FROM crm_account_consents WHERE user_id='${user}' ` +
          `AND accepted_at='${consentedAt}'::timestamptz`,
      ),
      '2',
    );
    assert.equal(query(`SELECT count(*) FROM crm_account_events WHERE user_id='${user}'`), '1');
    assert.equal(
      query(`SELECT origin FROM crm_company_profiles WHERE workspace_id='${user}'`),
      'signup',
    );
});

test('verified signup releases only an abandoned invitation and preserves its audit UUID', async () => {
  const address = email('released');
  const oldId = invitationFixture(address, false);
  const pending = await started(details({ email: address }));
  const response = await verify(pending.ticket);
  assert.equal(response.status, 201, JSON.stringify(response.value));
  assert.notEqual(response.value.user.id, oldId);
  assert.equal(
    query(
      `SELECT active::int||'|'||(deleted_at IS NOT NULL)::int FROM crm_users WHERE id='${oldId}'`,
    ),
    '0|1',
  );
  assert.equal(
    query(`SELECT email FROM crm_users WHERE id='${oldId}'`),
    `released-${oldId}@released.invalid`,
  );
  assert.equal(query(`SELECT count(*) FROM crm_team_activity WHERE member_id='${oldId}'`), '1');
  assert.equal(query(`SELECT count(*) FROM crm_users WHERE email='${address}'`), '1');
});

test('a self-signed-up Admin stays inside its own company authority', async () => {
  const pending = await started(details({ email: email('scoped') }));
  const signup = await verify(pending.ticket);
  const cookie = signup.headers.get('set-cookie').split(';')[0];
  const csrf = signup.value.csrfToken;
  const user = signup.value.user.id;
  const call = (path, options = {}) => request(path, { cookie, csrf, ...options });
  const directory = await call('/workspaces');
  assert.equal(directory.status, 200);
  assert.equal(directory.value.workspaces.length, 1);
  assert.equal(directory.value.workspaces[0].id, user);
  assert.equal((await call('/workspaces/super-admin-workspace/records')).status, 403);
  assert.equal(
    (
      await call(`/workspaces/${user}/team/invitations`, {
        method: 'POST',
        body: {
          name: 'Forbidden Admin',
          email: email('forbidden-admin'),
          phone: '+971501234567',
          positions: [],
          accountRole: 'admin',
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(`/workspaces/${user}/imports/preview`, {
        method: 'POST',
        body: {},
      })
    ).status,
    403,
  );
});
