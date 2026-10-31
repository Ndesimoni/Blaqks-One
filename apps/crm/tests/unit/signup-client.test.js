import assert from 'node:assert/strict';
import test from 'node:test';
import { createCrmClient } from '../../src/services/crm/client.js';

const response = (status, json) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => json,
});

test('sign-up uses public routes then installs CSRF for company setup', async () => {
  const calls = [];
  const api = createCrmClient(async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/signup/status'))
      return response(200, { enabled: true, terms: {}, privacy: {} });
    if (url.endsWith('/signup/start')) return response(202, { requestId: 'request-1' });
    if (url.endsWith('/signup/resend')) return response(202, { resendAfterSeconds: 60 });
    if (url.endsWith('/signup/verify'))
      return response(200, {
        user: { id: 'member-1', workspaceId: 'workspace/1' },
        company: { version: 1 },
        csrfToken: 'signup-csrf',
      });
    return response(200, {
      accountType: 'brokerage',
      memberLimit: 3,
      displayName: 'Noor Realty',
      emirate: 'dubai',
      setupComplete: true,
      version: 2,
    });
  });
  await api.signupStatus();
  await api.signupStart({ email: 'synthetic@example.test' });
  await api.signupResend('request-1', 'local-development');
  const verified = await api.signupVerify('request-1', '012345');
  await api.updateCompany('workspace/1', { version: 1, displayName: 'Noor' });

  assert.deepEqual(verified, {
    user: { id: 'member-1', workspaceId: 'workspace/1' },
    company: { version: 1 },
  });
  assert.equal(calls[0].url, '/api/crm/signup/status');
  assert.deepEqual(JSON.parse(calls[1].options.body), { email: 'synthetic@example.test' });
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    requestId: 'request-1',
    botToken: 'local-development',
  });
  assert.deepEqual(JSON.parse(calls[3].options.body), {
    requestId: 'request-1',
    code: '012345',
  });
  assert.equal(calls[4].url, '/api/crm/workspaces/workspace%2F1/company');
  assert.equal(calls[4].options.headers['X-CSRF-Token'], 'signup-csrf');
});

test('verification rejects incomplete session handoff without installing it', async () => {
  const api = createCrmClient(async () =>
    response(200, { user: { id: 'member-1' }, company: { version: 1 } }),
  );
  await assert.rejects(api.signupVerify('request-1', '012345'), /response was incomplete/);
});
