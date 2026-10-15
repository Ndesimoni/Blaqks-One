import test from 'node:test';
import assert from 'node:assert/strict';
import {
  meetsPasswordPolicy,
  passwordRules,
  weakPasswordMessage,
} from '../../src/lib/passwordPolicy.js';
import { createCrmClient } from '../../src/services/crm/client.js';

const unmet = (password, context) =>
  passwordRules(password, context)
    .filter((rule) => !rule.met)
    .map((rule) => rule.id);

test('new passwords need length, upper and lower case, a number and a special character', () => {
  assert.equal(meetsPasswordPolicy('Synth3tic!'), true);
  assert.deepEqual(unmet('Sh0rt!'), ['length']);
  assert.deepEqual(unmet('synth3tic!'), ['upper']);
  assert.deepEqual(unmet('SYNTH3TIC!'), ['lower']);
  assert.deepEqual(unmet('Synthetic!'), ['number']);
  assert.deepEqual(unmet('Synth3tic9'), ['special']);
  assert.equal(meetsPasswordPolicy('Pass 1word'), true);
  assert.equal(meetsPasswordPolicy('Éclair9#x'), true);
  assert.equal(meetsPasswordPolicy(''), false);
  assert.match(weakPasswordMessage, /^Use at least 8 characters/);
});

test('length counts characters while the cap counts bytes, like the server', () => {
  assert.deepEqual(unmet('Aa1!aaa'), ['length']);
  assert.equal(meetsPasswordPolicy(`Aa1!${'a'.repeat(1020)}`), true);
  assert.deepEqual(unmet(`Aa1!${'a'.repeat(1021)}`), ['bytes']);
  assert.deepEqual(unmet(`Aa1!${'é'.repeat(511)}`), ['bytes']);
});

test('the new password must differ from the current password and the email', () => {
  const context = { current: 'Old3tic!x', email: 'synthetic.member1@example.test' };
  assert.deepEqual(unmet('Old3tic!x', context), ['current']);
  assert.deepEqual(unmet(' Synthetic.Member1@Example.test ', context), ['email']);
  assert.equal(meetsPasswordPolicy('New3tic!x', context), true);
  assert.deepEqual(
    passwordRules('', context).map((rule) => rule.id),
    ['length', 'upper', 'lower', 'number', 'special', 'current', 'email'],
  );
});

const response = (status, json) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => json,
});

test('a password change swaps the in-memory CSRF token without exposing it', async () => {
  const calls = [];
  const api = createCrmClient(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/session'))
      return response(200, { user: { id: 'member-a' }, csrfToken: 'old-token' });
    if (url.endsWith('/auth/account/password'))
      return response(200, { csrfToken: 'rotated-token', signedOutOthers: 2 });
    return response(200, { revoked: 0 });
  });
  await api.session();
  const result = await api.changePassword('Old3tic!x', 'New3tic!x');
  assert.deepEqual(result, { signedOutOthers: 2 });
  await api.revokeOtherSessions();
  await api.revokeSession('session/1');
  assert.equal(calls[1].options.headers['X-CSRF-Token'], 'old-token');
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    currentPassword: 'Old3tic!x',
    newPassword: 'New3tic!x',
  });
  assert.equal(calls[2].url, '/api/crm/auth/sessions/revoke-others');
  assert.equal(calls[2].options.headers['X-CSRF-Token'], 'rotated-token');
  assert.equal(calls[3].url, '/api/crm/auth/sessions/session%2F1');
  assert.equal(calls[3].options.method, 'DELETE');
  assert.equal(calls[3].options.headers['X-CSRF-Token'], 'rotated-token');
});

test('a wrong current password keeps the session and the existing CSRF token', async () => {
  const signedOut = [];
  const calls = [];
  const api = createCrmClient(
    async (url, options) => {
      calls.push(options);
      if (url.endsWith('/auth/session'))
        return response(200, { user: { id: 'member-a' }, csrfToken: 'kept-token' });
      if (url.endsWith('/auth/account/password'))
        return response(400, {
          message: 'Current password is incorrect.',
          code: 'invalid_current_password',
        });
      return response(200, {});
    },
    (path) => signedOut.push(path),
  );
  await api.session();
  await assert.rejects(api.changePassword('Wr0ng!pass', 'New3tic!x'), {
    status: 400,
    message: 'Current password is incorrect.',
  });
  await api.updateAccount({ version: 1, name: 'Synthetic' });
  assert.deepEqual(signedOut, []);
  assert.equal(calls[2].headers['X-CSRF-Token'], 'kept-token');
  assert.deepEqual(JSON.parse(calls[2].body), { version: 1, name: 'Synthetic' });
});
