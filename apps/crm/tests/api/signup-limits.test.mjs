import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { before, test } from 'node:test';
import { query, request } from './helpers.mjs';
import {
  botToken,
  codeFor,
  details,
  digest,
  email,
  resetSignup,
  start,
  started,
  verify,
} from './signup-helpers.mjs';

before(resetSignup);

const resend = (ticket) =>
  request('/signup/resend', {
    method: 'POST',
    body: { requestId: ticket, botToken },
  });

test('per-email starts are bounded and expired throttle keys are cleaned', async () => {
  const address = email('limited');
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await start(details({ email: address }));
    assert.equal(response.status, attempt <= 3 ? 202 : 429);
  }
  query(
    'INSERT INTO crm_login_limits(key_hash,attempts,window_started,window_seconds) ' +
      "VALUES('synthetic-expired-signup',1,now()-interval '2 hours',60)",
  );
  await start(details({ email: email('cleanup') }));
  assert.equal(
    query("SELECT count(*) FROM crm_login_limits WHERE key_hash='synthetic-expired-signup'"),
    '0',
  );
});

test('wrong, expired and exhausted codes have fixed errors and atomic counters', async () => {
  const wrong = await started(details({ email: email('wrong') }));
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await verify(wrong.ticket, '999999');
    assert.equal(response.status, attempt < 5 ? 400 : 429);
    assert.equal(response.value.code, attempt < 5 ? 'invalid_code' : 'code_locked');
  }
  assert.equal(
    query(
      `SELECT code_attempts FROM crm_signup_requests WHERE ticket_hash='${digest(wrong.ticket)}'`,
    ),
    '5',
  );
  const expired = await started(details({ email: email('expired') }));
  // Read the code before expiring it: the API's cleanup may remove an expired request.
  const code = codeFor(expired.ticket);
  query(
    `UPDATE crm_signup_requests SET code_expires_at=now()-interval '1 second' ` +
      `WHERE ticket_hash='${digest(expired.ticket)}'`,
  );
  const response = await verify(expired.ticket, code);
  assert.equal(response.status, 400);
  assert.equal(response.value.code, 'invalid_code');
});

test('resend cooldown, send cap, replacement and unknown handles are uniform', async () => {
  const pending = await started(details({ email: email('resend') }));
  const oldCode = codeFor(pending.ticket);
  const cooldown = await resend(pending.ticket);
  assert.equal(cooldown.status, 429);
  assert.equal(cooldown.value.code, 'resend_too_soon');
  assert.ok(Number(cooldown.headers.get('retry-after')) > 0);
  query(
    `UPDATE crm_signup_requests SET last_sent_at=now()-interval '61 seconds' ` +
      `WHERE ticket_hash='${digest(pending.ticket)}'`,
  );
  const sent = await resend(pending.ticket);
  assert.equal(sent.status, 202);
  const freshCode = codeFor(pending.ticket);
  assert.notEqual(freshCode, oldCode);
  assert.equal((await verify(pending.ticket, oldCode)).value.code, 'invalid_code');
  assert.equal(
    query(
      `SELECT total_attempts FROM crm_signup_requests WHERE ticket_hash='${digest(pending.ticket)}'`,
    ),
    '1',
  );
  query(
    `UPDATE crm_signup_requests SET sends=5,last_sent_at=now()-interval '61 seconds' ` +
      `WHERE ticket_hash='${digest(pending.ticket)}'`,
  );
  assert.equal((await resend(pending.ticket)).status, 429);
  const unknown = randomBytes(32).toString('base64url');
  const anonymous = await resend(unknown);
  assert.equal(anonymous.status, 202);
  assert.deepEqual(Object.keys(anonymous.value).sort(), ['expiresAt', 'resendAfterSeconds']);
});

test('starts and resends share the same per-email send budget', async () => {
  const address = email('shared-send-budget');
  const first = await started(details({ email: address }));
  const second = await started(details({ email: address }));
  query(
    `UPDATE crm_signup_requests SET last_sent_at=now()-interval '61 seconds' ` +
      `WHERE email='${address}'`,
  );
  assert.equal((await resend(first.ticket)).status, 202);
  assert.equal((await resend(second.ticket)).status, 429);
});

test('invented verification handles cannot block a genuine verification', async () => {
  const pending = await started(details({ email: email('real-after-noise') }));
  const noise = [];
  for (let offset = 0; offset < 305; offset += 20) {
    noise.push(
      ...(await Promise.all(
        Array.from({ length: Math.min(20, 305 - offset) }, () =>
          verify(randomBytes(32).toString('base64url'), '999999'),
        ),
      )),
    );
  }
  assert.ok(noise.every(({ status }) => status === 400));
  assert.equal((await verify(pending.ticket)).status, 201);
});

test('successful company creation has transactional hourly and daily budgets', async () => {
  const pending = await started(details({ email: email('company-budget') }));
  query(
    `INSERT INTO crm_login_limits(key_hash,attempts,window_seconds) VALUES ` +
      `('${digest('signup:company:hour')}',30,3600) ON CONFLICT (key_hash) DO UPDATE SET ` +
      `attempts=30,window_started=now(),window_seconds=3600`,
  );
  const response = await verify(pending.ticket);
  assert.equal(response.status, 429);
  assert.equal(response.value.code, 'rate_limited');
  assert.equal(query(`SELECT count(*) FROM crm_users WHERE email='${pending.body.email}'`), '0');
  assert.equal(
    query(`SELECT count(*) FROM crm_signup_requests WHERE email='${pending.body.email}'`),
    '1',
  );
});
