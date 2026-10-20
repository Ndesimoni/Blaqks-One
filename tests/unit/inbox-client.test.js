import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrmClient } from '../../src/services/crm/client.js';

const response = (status, json) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => json,
});

test('Inbox calls use scoped, encoded paths, filters and CSRF on every change', async () => {
  const calls = [];
  const api = createCrmClient(async (url, options) => {
    calls.push({ url, options });
    return url.endsWith('/auth/login')
      ? response(200, { user: { id: 'member-a' }, csrfToken: 'anti-forgery' })
      : response(200, {});
  });
  await api.login('admin@example.test', 'synthetic password');
  await api.conversations('ws/1', { state: 'new', channel: '', assignee: 'me', cursor: null });
  await api.conversation('ws/1', 'c 1');
  await api.updateConversation('ws/1', 'c1', { expectedVersion: 2, state: 'resolved' });
  await api.createLeadFromConversation('ws/1', 'c1', { expectedVersion: 3 });
  await api.blockConversation('ws/1', 'c1', { expectedVersion: 4 });
  await api.saveInboxRules('ws/1', { expectedVersion: 0 });
  const [, list, read, patch, lead, block, rules] = calls;
  assert.equal(list.url, '/api/crm/workspaces/ws%2F1/inbox/conversations?state=new&assignee=me');
  assert.equal(list.options.headers['X-CSRF-Token'], undefined);
  assert.equal(read.url, '/api/crm/workspaces/ws%2F1/inbox/conversations/c%201');
  assert.equal(patch.options.method, 'PATCH');
  assert.equal(lead.url, '/api/crm/workspaces/ws%2F1/inbox/conversations/c1/lead');
  assert.equal(block.url, '/api/crm/workspaces/ws%2F1/inbox/conversations/c1/block');
  assert.equal(rules.url, '/api/crm/workspaces/ws%2F1/inbox/rules');
  assert.equal(rules.options.method, 'PUT');
  for (const change of [patch, lead, block, rules]) {
    assert.equal(change.options.headers['X-CSRF-Token'], 'anti-forgery');
  }
});
