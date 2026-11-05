import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrmClient, CrmApiError } from '../../src/services/crm/client.js';

const response = (status, json) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => json,
});

test('connected requests keep credentials in cookies and attach in-memory CSRF only to mutations', async () => {
  const calls = [];
  const api = createCrmClient(async (url, options) => {
    calls.push({ url, options });
    return url.endsWith('/auth/login') || url.endsWith('/auth/session')
      ? response(200, { user: { id: 'member-a' }, csrfToken: 'anti-forgery' })
      : response(200, {});
  });
  await api.login('admin@example.com', 'private password');
  await api.records('workspace/one');
  await api.save(
    'workspace/one',
    'Clients',
    { client_id: 'CL-001' },
    { id: 'canonical-id', version: 3 },
  );
  await api.logout();
  await api.save('workspace/one', 'Clients', { client_id: 'CL-002' });
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[0].options.headers['X-CSRF-Token'], undefined);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    email: 'admin@example.com',
    password: 'private password',
  });
  assert.equal(calls[1].url, '/api/crm/workspaces/workspace%2Fone/records');
  assert.equal(calls[1].options.headers['X-CSRF-Token'], undefined);
  assert.equal(calls[2].options.headers['X-CSRF-Token'], 'anti-forgery');
  assert.equal(calls[2].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    record: { client_id: 'CL-001' },
    version: 3,
  });
  assert.equal(calls[3].options.headers['X-CSRF-Token'], 'anti-forgery');
  assert.equal(calls[4].options.headers['X-CSRF-Token'], undefined);
});

test('conflicts retain status and field errors without silently retrying a mutation', async () => {
  let count = 0;
  const api = createCrmClient(async () => {
    count++;
    return response(409, {
      message: 'This record changed.',
      errors: { client_id: 'Already used.' },
    });
  });
  await assert.rejects(api.save('own', 'Clients', { client_id: 'CL-001' }), (error) => {
    assert.ok(error instanceof CrmApiError);
    assert.equal(error.status, 409);
    assert.equal(error.details.errors.client_id, 'Already used.');
    return true;
  });
  assert.equal(count, 1);
});

test('server failures and malformed identity never become a local demo session', async () => {
  const unreachable = createCrmClient(async () => {
    throw Error('network error');
  });
  await assert.rejects(unreachable.session(), /server could not be reached/);
  const malformed = createCrmClient(async () => response(200, { user: { id: 'one' } }));
  await assert.rejects(malformed.session(), /incomplete session/);
  const signedOut = createCrmClient(async () => response(401, { message: 'Sign in required.' }));
  await assert.rejects(signedOut.session(), (error) => error.status === 401);
});

test('abort signals propagate and stale loads can be cancelled without creating a session', async () => {
  const controller = new AbortController();
  const cancelled = new DOMException('Aborted', 'AbortError');
  const api = createCrmClient(async (_url, options) => {
    assert.equal(options.signal, controller.signal);
    throw cancelled;
  });
  await assert.rejects(api.session(controller.signal), (error) => error === cancelled);
});

test('expired sessions clear identity and expired logout completes, while wrong passwords and 403 do not', async () => {
  const lost = [];
  const api = createCrmClient(
    async (url) =>
      response(url.includes('/workspaces/forbidden') ? 403 : 401, { message: 'Not authorised.' }),
    (path) => lost.push(path),
  );
  await assert.rejects(api.login('admin@example.com', 'wrong'), (error) => error.status === 401);
  assert.deepEqual(lost, []);
  await assert.rejects(api.records('forbidden'), (error) => error.status === 403);
  assert.deepEqual(lost, []);
  await assert.rejects(api.records('own'), (error) => error.status === 401);
  assert.deepEqual(lost, ['/workspaces/own/records']);
  await api.logout();
  assert.deepEqual(lost, ['/workspaces/own/records', '/auth/logout']);
});
