import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, origin, query, request } from './helpers.mjs';
import { findMember, invite, memberUpdate, teamPath } from './team-helpers.mjs';
import { newStaff, signIn } from './account-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

const setLanguage = (session, body, options = {}) =>
  session.request('/auth/account/language', { method: 'PUT', body, ...options });
const stored = (id) => query(`SELECT language FROM crm_users WHERE id='${id}'`);
const events = (id) => query(`SELECT count(*) FROM crm_account_events WHERE user_id='${id}'`) * 1;

test('every account starts in English across login, session and account payloads', async () => {
  const admin = await login('admin-a');
  const staff = await newStaff(admin, 'language-default');
  assert.equal(staff.user.language, 'en');
  assert.equal((await staff.request('/auth/session')).value.user.language, 'en');
  assert.equal((await staff.request('/auth/account')).value.user.language, 'en');
  assert.equal(stored(staff.user.id), 'en');
  const invited = await invite(admin, 'language-invited');
  assert.equal(stored(invited.member.id), 'en');
});

test('only English and Arabic are accepted, with CSRF and origin checks', async () => {
  const admin = await login('admin-a');
  const staff = await newStaff(admin, 'language-allowlist');
  for (const body of [
    { language: 'fr' },
    { language: 'AR' },
    { language: ' ar' },
    { language: 'ar-AE' },
    { language: '' },
    { language: 1 },
    { language: null },
    {},
    { language: 'ar', userId: admin.user.id },
    { language: 'ar', version: 1 },
  ]) {
    const refused = await setLanguage(staff, body);
    assert.equal(refused.status, 400, JSON.stringify(body));
  }
  assert.equal((await setLanguage(staff, { language: 'ar' }, { csrf: undefined })).status, 403);
  const foreign = { headers: { Origin: `${origin}.invalid` } };
  assert.equal((await setLanguage(staff, { language: 'ar' }, foreign)).status, 403);
  const anonymous = await request('/auth/account/language', {
    method: 'PUT',
    body: { language: 'ar' },
  });
  assert.equal(anonymous.status, 401);
  assert.equal(stored(staff.user.id), 'en');
  assert.equal(events(staff.user.id), 0);
});

test('a saved language persists without bumping the account version', async () => {
  const admin = await login('admin-a');
  const staff = await newStaff(admin, 'language-persist');
  const before = (await staff.request('/auth/account')).value;
  const saved = await setLanguage(staff, { language: 'ar' });
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
  assert.equal(saved.value.user.language, 'ar');
  assert.equal(saved.value.user.id, staff.user.id);
  assert.equal(saved.value.version, before.version);
  assert.equal(stored(staff.user.id), 'ar');
  assert.equal((await staff.request('/auth/session')).value.user.language, 'ar');
  assert.equal((await signIn(staff.email)).user.language, 'ar');
  // The event names the action only; repeating the same choice logs nothing new.
  assert.equal(events(staff.user.id), 1);
  assert.equal((await setLanguage(staff, { language: 'ar' })).status, 200);
  assert.equal(events(staff.user.id), 1);
  assert.equal(
    query(`SELECT action FROM crm_account_events WHERE user_id='${staff.user.id}'`),
    'profile_updated',
  );
  // Name and phone edits still use the unchanged version.
  const edited = await staff.request('/auth/account', {
    method: 'PATCH',
    body: { version: before.version, name: 'Synthetic Language Edited' },
  });
  assert.equal(edited.status, 200, JSON.stringify(edited.value));
  assert.equal(edited.value.user.language, 'ar');
  const back = await setLanguage(staff, { language: 'en' });
  assert.equal(back.value.user.language, 'en');
  assert.equal(stored(staff.user.id), 'en');
});

test('members change only their own language; Admins have no power over it', async () => {
  const admin = await login('admin-a');
  const owner = await login('owner');
  const staff = await newStaff(admin, 'language-own');
  assert.equal((await setLanguage(admin, { language: 'ar' })).status, 200);
  assert.equal(stored(admin.user.id), 'ar');
  assert.equal(stored(staff.user.id), 'en');
  assert.equal((await staff.request('/auth/session')).value.user.language, 'en');
  const member = await findMember(admin, staff.user.id);
  assert.equal('language' in member, false);
  const viaTeam = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { language: 'ar' }),
  });
  assert.equal(viaTeam.status, 400);
  assert.equal(stored(staff.user.id), 'en');
  const elsewhere = await owner.request(`/auth/account/language?userId=${staff.user.id}`, {
    method: 'PUT',
    body: { language: 'ar' },
  });
  assert.equal(elsewhere.status, 200);
  assert.equal(stored(owner.user.id), 'ar');
  assert.equal(stored(staff.user.id), 'en');
  for (const session of [admin, owner])
    assert.equal((await setLanguage(session, { language: 'en' })).status, 200);
});

test('suspended callers cannot change their language', async () => {
  const admin = await login('admin-a');
  const staff = await newStaff(admin, 'language-suspended');
  const member = await findMember(admin, staff.user.id);
  const off = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { active: false }),
  });
  assert.equal(off.status, 200, JSON.stringify(off.value));
  assert.equal((await setLanguage(staff, { language: 'ar' })).status, 401);
  assert.equal(stored(staff.user.id), 'en');
});
