import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrmClient } from '../../src/services/crm/client.js';

test('migration preview and idempotent commit use authenticated scoped POST requests with one unchanged token', async () => {
  const calls = [];
  const api = createCrmClient(async (url, options) => {
    calls.push({ url, options });
    return {
      status: 200,
      ok: true,
      json: async () =>
        url.endsWith('/auth/session') ? { user: { id: 'real-owner' }, csrfToken: 'csrf' } : {},
    };
  });
  await api.session();
  const payload = {
    sourceWorkspaceId: 'aidah',
    records: { Clients: [], Contacts: [], Properties: [] },
  };
  await api.previewImport('real/aidah', payload);
  await api.commitImport('real/aidah', 'preview-token');
  await api.commitImport('real/aidah', 'preview-token');
  assert.equal(calls[1].url, '/api/crm/workspaces/real%2Faidah/imports/preview');
  assert.deepEqual(JSON.parse(calls[1].options.body), payload);
  for (const call of calls.slice(1)) {
    assert.equal(call.options.method, 'POST');
    assert.equal(call.options.credentials, 'include');
    assert.equal(call.options.headers['X-CSRF-Token'], 'csrf');
  }
  assert.equal(calls[2].url, '/api/crm/workspaces/real%2Faidah/imports/commit');
  assert.equal(calls[2].options.body, calls[3].options.body);
  assert.deepEqual(JSON.parse(calls[2].options.body), { token: 'preview-token' });
});
