import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import {
  codeFor,
  details,
  digest,
  email,
  resetSignup,
  started,
  verify,
} from './signup-helpers.mjs';

before(resetSignup);

test('two verified requests for one email create exactly one company without deadlock', async () => {
  const address = email('parallel');
  const first = await started(details({ email: address }));
  const second = await started(details({ email: address }));
  const results = await Promise.all([
    verify(first.ticket, codeFor(first.ticket)),
    verify(second.ticket, codeFor(second.ticket)),
  ]);
  assert.deepEqual(results.map(({ status }) => status).sort(), [201, 400]);
  assert.equal(results.find(({ status }) => status === 400).value.code, 'invalid_code');
  assert.equal(query(`SELECT count(*) FROM crm_users WHERE email='${address}'`), '1');
  assert.equal(
    query(
      `SELECT count(*) FROM crm_company_profiles p JOIN crm_users u ` +
        `ON p.workspace_id=u.id::text WHERE u.email='${address}'`,
    ),
    '1',
  );
  assert.equal(query(`SELECT count(*) FROM crm_signup_requests WHERE email='${address}'`), '0');
});

test('parallel guesses consume at most five attempts', async () => {
  const pending = await started(details({ email: email('guesses') }));
  const responses = await Promise.all(
    Array.from({ length: 20 }, () => verify(pending.ticket, '999999')),
  );
  assert.ok(responses.every(({ status }) => status === 400 || status === 429));
  assert.equal(
    query(
      `SELECT code_attempts FROM crm_signup_requests ` +
        `WHERE ticket_hash='${digest(pending.ticket)}'`,
    ),
    '5',
  );
});

test('the same request can be verified only once', async () => {
  const pending = await started(details({ email: email('same-ticket') }));
  const code = codeFor(pending.ticket);
  const responses = await Promise.all([verify(pending.ticket, code), verify(pending.ticket, code)]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 400]);
  assert.equal(query(`SELECT count(*) FROM crm_users WHERE email='${pending.body.email}'`), '1');
});

test('a late failure rolls back the entire account creation transaction', async () => {
  const pending = await started(details({ email: email('rollback') }));
  query(
    `CREATE OR REPLACE FUNCTION crm_test_fail_consent() RETURNS trigger LANGUAGE plpgsql AS ` +
      `$$BEGIN RAISE EXCEPTION 'synthetic consent failure'; END$$; ` +
      `CREATE TRIGGER crm_test_fail_consent BEFORE INSERT ON crm_account_consents ` +
      `FOR EACH STATEMENT EXECUTE FUNCTION crm_test_fail_consent()`,
  );
  let response;
  try {
    response = await verify(pending.ticket);
  } finally {
    query(
      `DROP TRIGGER crm_test_fail_consent ON crm_account_consents; ` +
        `DROP FUNCTION crm_test_fail_consent()`,
    );
  }
  assert.equal(response.status, 503);
  assert.equal(query(`SELECT count(*) FROM crm_users WHERE email='${pending.body.email}'`), '0');
  assert.equal(
    query(`SELECT count(*) FROM crm_signup_requests WHERE email='${pending.body.email}'`),
    '1',
  );
});

test('verification racing an Admin invitation leaves one identity and workspace', async () => {
  const address = email('invite-race');
  const pending = await started(details({ email: address }));
  const owner = await login('owner');
  const [signup, invitation] = await Promise.all([
    verify(pending.ticket, codeFor(pending.ticket)),
    owner.request('/workspaces/super-admin-workspace/team/invitations', {
      method: 'POST',
      body: {
        name: 'Synthetic Invited Admin',
        email: address,
        phone: '+971501234567',
        positions: [],
        accountRole: 'admin',
      },
    }),
  ]);
  assert.deepEqual([signup.status, invitation.status].sort(), [201, 409]);
  assert.equal(query(`SELECT count(*) FROM crm_users WHERE email='${address}'`), '1');
  assert.equal(
    query(
      `SELECT count(*) FROM crm_workspaces w JOIN crm_users u ` +
        `ON w.owner_id=u.id WHERE u.email='${address}'`,
    ),
    '1',
  );
});
