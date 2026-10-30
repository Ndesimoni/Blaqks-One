import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { api, query, request } from './helpers.mjs';
import {
  codeFor,
  details,
  digest,
  privacy,
  resetSignup,
  start,
  started,
  terms,
} from './signup-helpers.mjs';

before(resetSignup);

test('status exposes only local public configuration', async () => {
  const browserShape = await fetch(`${api}/signup/status`);
  assert.equal(browserShape.status, 200);
  const response = await request('/signup/status');
  assert.equal(response.status, 200);
  assert.deepEqual(response.value, {
    enabled: true,
    mode: 'local',
    botCheck: { provider: 'local', siteKey: null },
    terms: { version: terms, url: '/terms' },
    privacy: { version: privacy, url: '/privacy' },
  });
});

test('start validates strict fields, origin, consent and bot proof before writing', async () => {
  const cases = [
    [{ accountType: 'brokerage' }, 'invalid_request'],
    [{ name: ' ' }, 'invalid_name'],
    [{ email: 'invalid' }, 'invalid_email'],
    [{ phone: '0501234567' }, 'invalid_phone'],
    [{ password: 'weak' }, 'weak_password'],
    [{ termsVersion: '' }, 'consent_required'],
    [{ termsVersion: 'old' }, 'consent_outdated'],
    [{ language: 'fr' }, 'invalid_language'],
    [{ botToken: 'bypass' }, 'bot_check_failed'],
    [{ role: 'super-admin' }, 'invalid_request'],
    [{ accountRole: 'admin' }, 'invalid_request'],
    [{ workspaceId: 'super-admin-workspace' }, 'invalid_request'],
    [{ memberLimit: null }, 'invalid_request'],
  ];
  for (const [change, code] of cases) {
    const response = await start(details(change));
    assert.equal(response.value.code, code, JSON.stringify(change));
  }
  const foreign = await request('/signup/start', {
    method: 'POST',
    headers: { Origin: 'https://foreign.example.test' },
    body: details(),
  });
  assert.equal(foreign.status, 403);
  assert.equal(query('SELECT count(*) FROM crm_signup_requests'), '0');
});

test('the pending request stores only ticket/code/password digests and returns no code', async () => {
  const body = details();
  const result = await started(body);
  const code = codeFor(result.ticket);
  assert.equal(result.ticket.length, 43);
  assert.deepEqual(Object.keys(result.response.value).sort(), [
    'expiresAt',
    'maskedEmail',
    'requestId',
    'resendAfterSeconds',
  ]);
  assert.equal(JSON.stringify(result.response.value).includes(code), false);
  const stored = query(
    `SELECT ticket_hash||'|'||code_hash||'|'||password_hash FROM crm_signup_requests ` +
      `WHERE ticket_hash='${digest(result.ticket)}'`,
  );
  assert.equal(stored.includes(result.ticket), false);
  assert.equal(stored.includes(code), false);
  assert.equal(stored.includes(body.password), false);
  assert.match(stored, /^[a-f0-9]{64}\|[a-f0-9]{64}\|\$argon2id\$/);
  assert.equal(
    query(`SELECT account_type FROM crm_signup_requests WHERE email='${body.email}'`),
    'brokerage',
  );
  const unauthenticated = await request('/auth/session', {
    cookie: `kws_crm_session=${result.ticket}`,
  });
  assert.equal(unauthenticated.status, 401);
});
