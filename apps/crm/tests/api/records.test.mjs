import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create, login, query, recordsPath } from './helpers.mjs';

// Each scenario file starts with a fresh rate-limit window in its isolated test database.
before(() => query('TRUNCATE crm_login_limits'));

test('records persist, retain workbook fields and enforce optimistic versions', async () => {
  const session = await login();
  const record = await create(session, 'Clients', {
    client_id: 'API-CLIENT-1',
    full_name: 'Synthetic Client',
    maximum_budget_aed: 1000000,
    original_workbook_note: 'Compatibility field',
  });
  const path = recordsPath(session, 'Clients', record.id);
  const update = await session.request(path, {
    method: 'PATCH',
    body: {
      record: { ...record.record, full_name: 'Updated Synthetic Client' },
      version: record.version,
    },
  });
  assert.equal(update.status, 200);
  assert.equal(update.value.version, 2);
  assert.equal(update.value.record.original_workbook_note, 'Compatibility field');
  const stale = await session.request(path, {
    method: 'PATCH',
    body: { record: record.record, version: 1 },
  });
  assert.equal(stale.status, 409);
  assert.equal(
    (await session.request(path, { method: 'DELETE', body: { version: 1 } })).status,
    409,
  );
  const fresh = await login();
  const list = await fresh.request(recordsPath(fresh));
  assert.equal(
    list.value.records.Clients.find((row) => row.id === record.id).record.full_name,
    'Updated Synthetic Client',
  );
  assert.equal(
    (await session.request(path, { method: 'DELETE', body: { version: 2 } })).status,
    200,
  );
});

test('Super Admin edits retain target ownership and redact immutable activity', async () => {
  const adminB = await login('admin-b');
  const owner = await login('owner');
  const record = await create(adminB, 'Clients', {
    client_id: 'API-AUDIT',
    full_name: 'Private name',
    email: 'private@crm-fixture.test',
    internal_notes: 'Private message body',
  });
  const update = await owner.request(recordsPath(adminB, 'Clients', record.id), {
    method: 'PATCH',
    body: { record: { ...record.record, full_name: 'Changed privately' }, version: 1 },
  });
  assert.equal(update.status, 200);
  const response = await owner.request(`/workspaces/${adminB.user.id}/activity`);
  assert.equal(response.status, 200);
  const serialized = JSON.stringify(response.value);
  assert.ok(!serialized.includes('private@crm-fixture.test'));
  assert.ok(!serialized.includes('Private message body'));
  const actor = query(
    `SELECT actor_id FROM crm_activity WHERE record_id='${record.id}' AND action='updated'`,
  );
  assert.equal(actor, owner.user.id);
  assert.equal(
    query(`SELECT workspace_id FROM crm_records WHERE id='${record.id}'`),
    adminB.user.id,
  );
  assert.throws(() =>
    query(`UPDATE crm_activity SET action='deleted' WHERE record_id='${record.id}'`),
  );
});
