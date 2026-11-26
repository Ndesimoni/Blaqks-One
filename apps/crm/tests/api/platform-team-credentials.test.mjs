// BO1b sign-in controls (owner 2026-11-05): the Owner signs a Blaqks One team member out or
// resets their password through a one-time link, without ever seeing a password.
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query, request } from './helpers.mjs';
import { newCompany } from './company-helpers.mjs';
import { activate, staffLogin } from './team-helpers.mjs';
import { PRESETS, TEAM, inviteTeam, teamMember } from './platform-team-helpers.mjs';

let owner, admin;

before(async () => {
  query('TRUNCATE crm_login_limits');
  ({ owner, admin } = await newCompany('platform-credentials'));
});

const signOut = (session, id) => session.request(`${TEAM}/${id}/sign-out`, { method: 'POST' });
const reset = (session, id, version) =>
  session.request(`${TEAM}/${id}/password-reset`, { method: 'POST', body: { version } });
const versionOf = async (id) =>
  (await owner.request(TEAM)).value.members.find((member) => member.id === id).version;
const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: { email, password } });
const events = (id) =>
  query(`SELECT string_agg(action,',' ORDER BY created_at) FROM crm_account_events
    WHERE user_id='${id}' AND actor_id='${owner.user.id}'`);

test('the Owner signs a member out everywhere at once', async () => {
  const member = await teamMember(owner, 'platform-credentials-out', 'analyst');
  const second = await staffLogin(member.user.email);
  const result = await signOut(owner, member.user.id);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.deepEqual(result.value, { signedOut: 2 });
  assert.equal((await member.request('/auth/session')).status, 401);
  assert.equal((await second.request('/auth/session')).status, 401);
  assert.equal((await staffLogin(member.user.email)).user.id, member.user.id, 'still active');
  assert.equal(events(member.user.id), 'sessions_revoked');
});

test('a password reset ends the old password and sessions; the link sets a new one', async () => {
  const member = await teamMember(owner, 'platform-credentials-reset', 'support');
  const { email } = member.user;
  const version = await versionOf(member.user.id);
  const result = await reset(owner, member.user.id, version);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.equal(result.value.member.status, 'pending');
  assert.equal(result.value.invitation.token.length, 43);
  assert.match(result.value.invitation.expiresAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.doesNotMatch(JSON.stringify(result.value.member), /password|hash/i);
  assert.equal((await member.request('/auth/session')).status, 401);
  assert.equal((await login(email, 'Team123!')).status, 401, 'the old password is unusable');
  assert.equal((await reset(owner, member.user.id, version)).status, 409, 'stale');
  const renewed = await activate({ ...result.value, email }, 'Renewed123!');
  assert.deepEqual(renewed.user.platformAccess, PRESETS.support);
  assert.equal((await login(email, 'Team123!')).status, 401);
  assert.equal((await login(email, 'Renewed123!')).status, 200);
  assert.equal(events(member.user.id), 'password_reset');
});

test('a reset needs an activated, active member', async () => {
  const pending = await inviteTeam(owner, 'platform-credentials-pending', 'analyst');
  assert.equal((await reset(owner, pending.member.id, pending.member.version)).status, 409);
  const member = await teamMember(owner, 'platform-credentials-suspended', 'analyst');
  const off = await owner.request(`${TEAM}/${member.user.id}/active`, {
    method: 'PUT',
    body: { version: await versionOf(member.user.id), active: false },
  });
  assert.equal(off.status, 200);
  assert.equal((await reset(owner, member.user.id, off.value.member.version)).status, 409);
});

test('only the Owner signs out or resets, and never their own account', async () => {
  const target = await teamMember(owner, 'platform-credentials-target', 'analyst');
  const version = await versionOf(target.user.id);
  assert.equal((await signOut(owner, owner.user.id)).status, 403);
  assert.equal((await reset(owner, owner.user.id, owner.user.version ?? 1)).status, 403);
  assert.equal((await signOut(owner, admin.user.id)).status, 403, 'not a company member');
  for (const preset of ['manager', 'sales', 'support', 'analyst']) {
    const staff = await teamMember(owner, `platform-credentials-${preset}`, preset);
    assert.equal((await signOut(staff, target.user.id)).status, 403, preset);
    assert.equal((await reset(staff, target.user.id, version)).status, 403, preset);
    assert.equal((await signOut(staff, staff.user.id)).status, 403, `${preset} self`);
  }
  assert.equal((await signOut(admin, target.user.id)).status, 403);
  assert.equal((await reset(admin, target.user.id, version)).status, 403);
  assert.equal((await target.request('/auth/session')).status, 200, 'nothing happened');
  const archived = await owner.request(`${TEAM}/${target.user.id}`, {
    method: 'DELETE',
    body: { version, confirmationEmail: target.user.email },
  });
  assert.equal(archived.status, 200, JSON.stringify(archived.value));
  assert.equal((await signOut(owner, target.user.id)).status, 403, 'archived');
  assert.equal((await reset(owner, target.user.id, archived.value.member.version)).status, 403);
});
