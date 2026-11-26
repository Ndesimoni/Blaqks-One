import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import {
  details,
  digest,
  email,
  invitationFixture,
  resetSignup,
  start,
  verify,
} from './signup-helpers.mjs';

before(resetSignup);

function identity(address, state) {
  if (state === 'pending') return invitationFixture(address, true);
  if (state === 'cancelled') return invitationFixture(address, false);
  const id = randomUUID();
  const archived = state === 'archived';
  query(
    `INSERT INTO crm_users(id,name,email,phone,password_hash,role,active,accepted_at,deleted_at) ` +
      `VALUES('${id}','Synthetic ${state}','${address}','+971501234567','fixture-hash','admin',` +
      `${state === 'active'},now(),${archived ? 'now()' : 'NULL'})`,
  );
  return id;
}

function outbox(ticket) {
  return query(
    `SELECT o.kind||'|'||COALESCE(o.code,'') FROM crm_signup_outbox o ` +
      `JOIN crm_signup_requests r ON r.id=o.request_id ` +
      `WHERE r.ticket_hash='${digest(ticket)}' ORDER BY o.created_at DESC LIMIT 1`,
  );
}

test('start has one response shape across all email states and decoys never receive a code', async () => {
  const fixtures = [
    ['new', email('new'), 'code'],
    ['active', email('active'), 'existing_account'],
    ['suspended', email('suspended'), 'existing_account'],
    ['pending', email('pending'), 'invitation_pending'],
    ['cancelled', email('cancelled'), 'code'],
    ['archived', email('archived'), 'email_unavailable'],
  ];
  const responses = [];
  for (const [state, address, kind] of fixtures) {
    if (state !== 'new') identity(address, state);
    const response = await start(details({ email: address }));
    assert.equal(response.status, 202, state);
    assert.deepEqual(Object.keys(response.value).sort(), [
      'expiresAt',
      'maskedEmail',
      'requestId',
      'resendAfterSeconds',
    ]);
    const stored = outbox(response.value.requestId).split('|');
    assert.equal(stored[0], kind, state);
    assert.equal(Boolean(stored[1]), kind === 'code', state);
    responses.push([state, response]);
  }
  for (const [state, response] of responses.filter(([name]) =>
    ['active', 'suspended', 'pending', 'archived'].includes(name),
  )) {
    const rejected = await verify(response.value.requestId, '000000');
    assert.equal(rejected.status, 400, state);
    assert.equal(rejected.value.code, 'invalid_code', state);
  }
});
