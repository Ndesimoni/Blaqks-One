import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { newStaff, signIn } from './account-helpers.mjs';
import { login, origin, query, request } from './helpers.mjs';
import { findMember } from './team-helpers.mjs';

let admin;
let staff;

before(async () => {
  query('TRUNCATE crm_login_limits');
  admin = await login('admin-a');
  // The Free plan has three seats, so every scenario reuses one staff member.
  staff = await newStaff(admin, 'guidance-member');
});

const setGuidance = (session, body, options = {}) =>
  session.request('/auth/account/guidance', { method: 'PUT', body, ...options });
const stored = (id) => query(`SELECT guidance_enabled FROM crm_users WHERE id='${id}'`);
const events = (id) => query(`SELECT count(*) FROM crm_account_events WHERE user_id='${id}'`) * 1;

test('every account starts with automatic field hints on', async () => {
  assert.equal(staff.user.guidanceEnabled, true);
  assert.equal((await staff.request('/auth/session')).value.user.guidanceEnabled, true);
  assert.equal((await staff.request('/auth/account')).value.user.guidanceEnabled, true);
  assert.equal(stored(staff.user.id), 't');
});

test('only an explicit boolean is accepted, with CSRF and origin checks', async () => {
  for (const body of [
    { enabled: 'false' },
    { enabled: 0 },
    { enabled: null },
    {},
    { guidanceEnabled: false },
    { enabled: false, userId: admin.user.id },
    { enabled: false, version: 1 },
  ]) {
    assert.equal((await setGuidance(staff, body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await setGuidance(staff, { enabled: false }, { csrf: undefined })).status, 403);
  const foreign = { headers: { Origin: `${origin}.invalid` } };
  assert.equal((await setGuidance(staff, { enabled: false }, foreign)).status, 403);
  const anonymous = await request('/auth/account/guidance', {
    method: 'PUT',
    body: { enabled: false },
  });
  assert.equal(anonymous.status, 401);
  assert.equal(stored(staff.user.id), 't');
  assert.equal(events(staff.user.id), 0);
});

test('a saved preference persists without bumping the account version', async () => {
  const before = (await staff.request('/auth/account')).value;
  const saved = await setGuidance(staff, { enabled: false });
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
  assert.equal(saved.value.user.guidanceEnabled, false);
  assert.equal(saved.value.version, before.version);
  assert.equal(stored(staff.user.id), 'f');
  assert.equal((await staff.request('/auth/session')).value.user.guidanceEnabled, false);
  assert.equal((await signIn(staff.email)).user.guidanceEnabled, false);
  // The event names the action only; repeating the same choice logs nothing new.
  assert.equal(events(staff.user.id), 1);
  assert.equal((await setGuidance(staff, { enabled: false })).status, 200);
  assert.equal(events(staff.user.id), 1);
  assert.equal(
    query(`SELECT action FROM crm_account_events WHERE user_id='${staff.user.id}'`),
    'profile_updated',
  );
  assert.equal((await setGuidance(staff, { enabled: true })).value.user.guidanceEnabled, true);
  assert.equal(stored(staff.user.id), 't');
});

test('members change only their own preference; Admins cannot change another', async () => {
  await setGuidance(staff, { enabled: true });
  assert.equal((await setGuidance(admin, { enabled: false })).status, 200);
  assert.equal(stored(admin.user.id), 'f');
  assert.equal(stored(staff.user.id), 't');
  const member = await findMember(admin, staff.user.id);
  assert.equal('guidanceEnabled' in member, false);
  const elsewhere = await admin.request(`/auth/account/guidance?userId=${staff.user.id}`, {
    method: 'PUT',
    body: { enabled: false },
  });
  assert.equal(elsewhere.status, 200);
  assert.equal(stored(admin.user.id), 'f');
  assert.equal(stored(staff.user.id), 't');
  await setGuidance(admin, { enabled: true });
});

test('suspended callers cannot change their preference', async () => {
  const member = await findMember(admin, staff.user.id);
  const off = await admin.request(`/workspaces/${admin.user.workspaceId}/team/${member.id}`, {
    method: 'PATCH',
    body: {
      version: member.version,
      name: member.name,
      phone: member.phone,
      positions: member.positions,
      permissions: member.permissions,
      channelAccess: member.channelAccess,
      active: false,
    },
  });
  assert.equal(off.status, 200, JSON.stringify(off.value));
  assert.equal((await setGuidance(staff, { enabled: false })).status, 401);
  assert.equal(stored(staff.user.id), 't');
});
