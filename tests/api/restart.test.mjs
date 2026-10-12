import assert from 'node:assert/strict';
import { test } from 'node:test';
import { request } from './helpers.mjs';

test('sessions and saved records survive an API process restart', async () => {
  const cookie = process.env.CRM_RESTART_COOKIE;
  assert.ok(cookie, 'The harness must restart the API before this scenario.');
  const identity = await request('/auth/session', { cookie });
  assert.equal(identity.status, 200);
  const directory = await request('/workspaces', { cookie });
  assert.equal(directory.status, 200);
  const workspace = directory.value.workspaces.find((entry) => entry.name === 'Fixture Admin A');
  const response = await request(`/workspaces/${workspace.id}/records`, { cookie });
  assert.equal(response.status, 200);
  const saved = response.value.records.Clients.find(
    (entry) => entry.record.client_id === 'API-RACE',
  );
  assert.equal(saved.version, 2);
  assert.ok(['First edit', 'Second edit'].includes(saved.record.full_name));
});
