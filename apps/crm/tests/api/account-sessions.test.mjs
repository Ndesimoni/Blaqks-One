import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import { chromeMac, newStaff, safariPhone, sessionStatus, signIn } from './account-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

const fields = ['createdAt', 'current', 'device', 'expiresAt', 'id', 'lastSeenAt'];

test('the session list shows only the caller’s own sessions, without secrets', async () => {
  const admin = await login('admin-a');
  const staff = await newStaff(admin, 'sessions-list');
  const phone = await signIn(staff.email, 'Team123!', safariPhone);
  await signIn(staff.email, 'Team123!', chromeMac);
  const listed = await phone.request('/auth/sessions');
  assert.equal(listed.status, 200);
  assert.equal(listed.value.length, 3);
  for (const row of listed.value) {
    assert.deepEqual(Object.keys(row).sort(), fields);
    assert.match(row.id, /^[0-9a-f-]{36}$/);
    assert.match(row.lastSeenAt, /^\d{4}-\d\d-\d\dT.*Z$/);
  }
  assert.deepEqual(
    listed.value.map((row) => [row.current, row.device]),
    [
      [true, 'Safari · iOS'],
      [false, 'Chrome · macOS'],
      [false, null],
    ],
  );
  const text = JSON.stringify(listed.value);
  assert.doesNotMatch(text, /token|csrf|Mozilla|AppleWebKit/i);
  assert.ok(!text.includes(phone.csrf) && !text.includes(phone.cookie.split('=')[1]));
  const stored = query(
    `SELECT string_agg(coalesce(device,'-'),',' ORDER BY device) FROM crm_sessions WHERE user_id='${staff.user.id}'`,
  );
  assert.equal(stored, 'Chrome · macOS,Safari · iOS,-');
  const own = (await admin.request('/auth/sessions')).value.map((row) => row.id);
  assert.ok(own.every((id) => !listed.value.some((row) => row.id === id)));
});

test('revoking checks ownership, refuses the current session and needs CSRF', async () => {
  const admin = await login('admin-a');
  const staff = await newStaff(admin, 'sessions-revoke');
  const second = await signIn(staff.email);
  const rows = (await staff.request('/auth/sessions')).value;
  const current = rows.find((row) => row.current);
  const target = rows.find((row) => !row.current);
  const adminRow = (await admin.request('/auth/sessions')).value[0];
  const remove = (session, id, options = {}) =>
    session.request(`/auth/sessions/${id}`, { method: 'DELETE', ...options });
  for (const id of [adminRow.id, 'not-a-session', '00000000-0000-4000-8000-000000000000']) {
    const missing = await remove(staff, id);
    assert.equal(missing.status, 404, id);
    assert.deepEqual(missing.value, { message: 'Session not found.', code: 'not_found' });
  }
  assert.equal(await sessionStatus(admin.cookie), 200);
  const self = await remove(staff, current.id);
  assert.equal(self.status, 400);
  assert.equal(self.value.message, 'Use Sign out on this device.');
  assert.equal((await remove(staff, target.id, { csrf: undefined })).status, 403);
  assert.equal(await sessionStatus(second.cookie), 200);
  assert.equal((await remove(staff, target.id)).status, 200);
  assert.equal(await sessionStatus(second.cookie), 401);
  assert.equal(await sessionStatus(staff.cookie), 200);
  assert.equal((await remove(staff, target.id)).status, 404);
  assert.equal(
    query(`SELECT string_agg(action,',') FROM crm_account_events WHERE user_id='${staff.user.id}'`),
    'session_revoked',
  );
});

test('signing out other devices leaves only the current session', async () => {
  const admin = await login('admin-a');
  const staff = await newStaff(admin, 'sessions-others');
  const others = [await signIn(staff.email), await signIn(staff.email)];
  const path = '/auth/sessions/revoke-others';
  assert.equal((await staff.request(path, { method: 'POST', csrf: undefined })).status, 403);
  const foreign = { method: 'POST', headers: { Origin: 'http://foreign.invalid' } };
  assert.equal((await staff.request(path, foreign)).status, 403);
  const revoked = await staff.request(path, { method: 'POST' });
  assert.deepEqual(revoked.value, { revoked: 2 });
  for (const other of others) assert.equal(await sessionStatus(other.cookie), 401);
  const rows = (await staff.request('/auth/sessions')).value;
  assert.deepEqual(
    rows.map((row) => row.current),
    [true],
  );
  assert.equal(await sessionStatus(admin.cookie), 200);
  assert.equal(
    query(`SELECT string_agg(action,',') FROM crm_account_events WHERE user_id='${staff.user.id}'`),
    'sessions_revoked',
  );
});

test('last seen refreshes at most every five minutes and events are immutable', async () => {
  const admin = await login('admin-a');
  const staff = await newStaff(admin, 'sessions-seen');
  const where = `user_id='${staff.user.id}'`;
  query(`UPDATE crm_sessions SET last_seen_at=now()-interval '10 minutes' WHERE ${where}`);
  assert.equal(await sessionStatus(staff.cookie), 200);
  const fresh = `SELECT last_seen_at>now()-interval '1 minute' FROM crm_sessions WHERE ${where}`;
  assert.equal(query(fresh), 't');
  query(`UPDATE crm_sessions SET last_seen_at=now()-interval '4 minutes' WHERE ${where}`);
  assert.equal(await sessionStatus(staff.cookie), 200);
  assert.equal(query(fresh), 'f');
  await staff.request('/auth/sessions/revoke-others', { method: 'POST' });
  for (const sql of [
    `UPDATE crm_account_events SET action='session_revoked' WHERE ${where}`,
    `DELETE FROM crm_account_events WHERE ${where}`,
    'TRUNCATE crm_account_events',
  ])
    assert.throws(() => query(sql), /immutable/);
  assert.equal(query(`SELECT count(*) FROM crm_account_events WHERE ${where}`), '1');
});
