import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, origin, query, request } from './helpers.mjs';

// Each scenario file starts with a fresh rate-limit window in its isolated test database.
before(() => query('TRUNCATE crm_login_limits'));

test('private routes require a server session', async () => {
  assert.equal((await request('/workspaces')).status, 401);
  assert.equal((await request('/auth/session')).status, 401);
});

test('login rejects wrong origins and uses generic credential errors', async () => {
  const body = { email: 'admin-a@crm-fixture.test', password: 'wrong-fixture-password' };
  const wrongOrigin = await request('/auth/login', {
    method: 'POST',
    body,
    headers: { Origin: 'https://untrusted.example' },
  });
  assert.equal(wrongOrigin.status, 403);
  const wrong = await request('/auth/login', { method: 'POST', body });
  const missing = await request('/auth/login', {
    method: 'POST',
    body: { ...body, email: 'missing@crm-fixture.test' },
  });
  assert.equal(wrong.status, 401);
  assert.equal(missing.status, 401);
  assert.deepEqual(wrong.value, missing.value);
});

test('sessions use private cookies, survive reload and reject duplicate cookies', async () => {
  const session = await login();
  const response = await session.request('/auth/session');
  assert.equal(response.status, 200);
  assert.equal(response.value.user.id, session.user.id);
  assert.equal(response.value.csrfToken, session.csrf);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const cookie = (
    await request('/auth/login', {
      method: 'POST',
      body: {
        email: 'admin-b@crm-fixture.test',
        password: process.env.CRM_FIXTURE_PASSWORD,
      },
    })
  ).headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\/api\/crm/);
  assert.equal(
    (
      await request('/auth/session', {
        cookie: `${session.cookie}; ${session.cookie}`,
      })
    ).status,
    401,
  );
});

test('logout needs the correct origin and session-bound CSRF then revokes replay', async () => {
  const session = await login('admin-b');
  const other = await login('owner');
  assert.equal(
    (
      await session.request('/auth/logout', {
        method: 'POST',
        csrf: undefined,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await session.request('/auth/logout', {
        method: 'POST',
        csrf: other.csrf,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await session.request('/auth/logout', {
        method: 'POST',
        headers: { Origin: `${origin}/wrong` },
      })
    ).status,
    403,
  );
  const loggedOut = await session.request('/auth/logout', { method: 'POST' });
  assert.equal(loggedOut.status, 200);
  assert.match(loggedOut.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await session.request('/auth/session')).status, 401);
});

test('expired and suspended sessions are rejected on each request', async () => {
  const expired = await login('admin-b');
  query(
    `UPDATE crm_sessions SET expires_at=now()-interval '1 second' WHERE user_id='${expired.user.id}'`,
  );
  assert.equal((await expired.request('/workspaces')).status, 401);
  const suspended = await login('admin-b');
  try {
    query(`UPDATE crm_users SET active=false WHERE id='${suspended.user.id}'`);
    assert.equal((await suspended.request('/workspaces')).status, 401);
  } finally {
    query(`UPDATE crm_users SET active=true WHERE id='${suspended.user.id}'`);
  }
});

test('the database stores password hashes and hashed session identifiers', async () => {
  const session = await login();
  const hash = query(`SELECT password_hash FROM crm_users WHERE id='${session.user.id}'`);
  assert.match(hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  const tokens = query("SELECT string_agg(token_hash,',') FROM crm_sessions");
  assert.ok(!tokens.includes(session.cookie.split('=')[1]));
});
