import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, origin, query, request } from './helpers.mjs';
import { findMember, invite } from './team-helpers.mjs';
import {
  changePassword,
  chromeMac,
  cookieOf,
  newStaff,
  sessionStatus,
  signIn,
} from './account-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

const weak = ['Sh0rt!', 'synth3tic!', 'SYNTH3TIC!', 'Synthetic!', 'Synth3tic9'];

test('new passwords must meet the policy at password change and invitation activation', async () => {
  const admin = await login('admin-a');
  const staff = await newStaff(admin, 'password-policy1');
  // Meets every character rule, but is the account email in another case.
  const asEmail = `P${staff.email.slice(1)}`;
  for (const value of [...weak, 'Team123!', asEmail]) {
    const refused = await changePassword(staff, 'Team123!', value);
    assert.equal(refused.status, 400, value);
    assert.equal(refused.value.code, 'weak_password');
    assert.equal(
      refused.value.message,
      'Use at least 8 characters with an uppercase letter, a lowercase letter, a number and a special character.',
    );
  }
  const email = 'Policy-Email1@team-fixture.test';
  const invited = await invite(admin, 'policy-email1', { email });
  for (const password of [...weak, email]) {
    const body = { token: invited.invitation.token, password };
    const refused = await request('/auth/invitations/accept', { method: 'POST', body });
    assert.equal(refused.status, 400, password);
    assert.equal(refused.value.code, 'weak_password');
  }
  const body = { token: invited.invitation.token, password: 'Synth3tic!' };
  assert.equal((await request('/auth/invitations/accept', { method: 'POST', body })).status, 200);
});

test('a wrong current password is a 400 that keeps the session, and the sixth try is limited', async () => {
  const admin = await login('admin-a');
  const staff = await newStaff(admin, 'password-throttle');
  const next = 'Changed1!pw';
  assert.equal((await changePassword(staff, 'Team123!', next, { csrf: undefined })).status, 403);
  const noOrigin = { headers: { Origin: `${origin}.invalid` } };
  assert.equal((await changePassword(staff, 'Team123!', next, noOrigin)).status, 403);
  assert.equal((await changePassword(staff, 'x'.repeat(1025), next)).status, 400);
  for (let attempt = 1; attempt <= 5; attempt++) {
    const wrong = await changePassword(staff, 'Wrong123!', next);
    assert.equal(wrong.status, 400);
    assert.equal(wrong.value.code, 'invalid_current_password');
    assert.equal(wrong.value.message, 'Current password is incorrect.');
    assert.equal(await sessionStatus(staff.cookie), 200);
  }
  const limited = await changePassword(staff, 'Team123!', next);
  assert.equal(limited.status, 429);
  assert.equal(limited.value.message, 'Too many password attempts. Try again later.');
  assert.equal(await sessionStatus(staff.cookie), 200);
  // The sign-in budget is separate from the password budget.
  await signIn(staff.email);
});

test('a password change rotates the session and CSRF tokens and signs out other devices', async () => {
  query('TRUNCATE crm_login_limits');
  const admin = await login('admin-a');
  const staff = await newStaff(admin, 'password-rotate');
  const browser = await signIn(staff.email, 'Team123!', chromeMac);
  const other = await signIn(staff.email);
  const version = (await findMember(admin, staff.user.id)).version;
  const changed = await changePassword(browser, 'Team123!', 'Rotated1!pw');
  assert.equal(changed.status, 200, JSON.stringify(changed.value));
  assert.deepEqual(Object.keys(changed.value).sort(), ['csrfToken', 'signedOutOthers']);
  assert.equal(changed.value.signedOutOthers, 2);
  const cookie = cookieOf(changed);
  assert.match(changed.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.notEqual(cookie, browser.cookie);
  assert.notEqual(changed.value.csrfToken, browser.csrf);
  for (const old of [browser, other, staff]) assert.equal(await sessionStatus(old.cookie), 401);
  assert.equal(await sessionStatus(cookie), 200);
  const rotated = { cookie, csrf: changed.value.csrfToken };
  const path = '/auth/sessions/revoke-others';
  const oldCsrf = await request(path, { method: 'POST', cookie, csrf: browser.csrf });
  assert.equal(oldCsrf.status, 403);
  assert.equal((await request(path, { method: 'POST', ...rotated })).status, 200);
  const sessions = await request('/auth/sessions', { cookie });
  assert.equal(sessions.value.length, 1);
  assert.equal(sessions.value[0].device, 'Chrome · macOS');
  const oldLogin = { email: staff.email, password: 'Team123!' };
  assert.equal((await request('/auth/login', { method: 'POST', body: oldLogin })).status, 401);
  await signIn(staff.email, 'Rotated1!pw');
  const member = await findMember(admin, staff.user.id);
  assert.equal(member.version, version);
  const account = await request('/auth/account', { cookie });
  assert.match(account.value.passwordChangedAt, /^\d{4}-\d\d-\d\dT/);
  assert.equal(
    query(`SELECT count(*) FROM crm_account_events WHERE user_id='${staff.user.id}'`),
    '2',
  );
  const leaked = (table, text) =>
    query(`SELECT count(*) FROM ${table} t WHERE row_to_json(t)::text LIKE '%${text}%'`);
  for (const text of ['Rotated1', 'Team123', changed.value.csrfToken, cookie.split('=')[1]])
    for (const table of ['crm_account_events', 'crm_team_activity'])
      assert.equal(leaked(table, text), '0', `${table} ${text.slice(0, 4)}`);
});
