import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readServerRecords,
  serverWorkspaceData,
  serverRecordMetadata,
  installServerRecord,
  connectedCollections,
} from '../../src/features/server/records.js';
import { serverMutationFailure } from '../../src/features/server/errors.js';

const client = (id, version, clientId, name) => ({
  id,
  version,
  record: { client_id: clientId, full_name: name },
});
const payload = () => ({
  records: {
    ...Object.fromEntries(connectedCollections.map((name) => [name, []])),
    Clients: [client('uuid-a', 1, 'CL-001', 'Own client')],
  },
});

test('server metadata stays separate from workbook records and unconnected collections remain empty', () => {
  const entries = readServerRecords(payload());
  const data = serverWorkspaceData(entries);
  assert.equal(data.Clients[0].full_name, 'Own client');
  assert.equal(data.Clients[0].id, undefined);
  assert.equal(data.Clients[0].version, undefined);
  assert.deepEqual(data.Deals, []);
  assert.deepEqual(data.Payments, []);
  assert.deepEqual(data.Viewings, []);
  assert.deepEqual(serverRecordMetadata(entries, 'Clients', data.Clients[0]), {
    id: 'uuid-a',
    version: 1,
  });
});

test('record updates follow immutable server identity even when workbook IDs change', () => {
  const entries = readServerRecords(payload());
  const updated = installServerRecord(
    entries,
    'Clients',
    client('uuid-a', 2, 'CL-RENAMED', 'Updated name'),
  );
  assert.equal(updated.Clients.length, 1);
  assert.equal(updated.Clients[0].record.client_id, 'CL-RENAMED');
  assert.equal(updated.Clients[0].version, 2);
  assert.equal(entries.Clients[0].record.client_id, 'CL-001');
  const added = installServerRecord(
    updated,
    'Clients',
    client('uuid-b', 1, 'CL-002', 'Second client'),
  );
  assert.equal(added.Clients.length, 2);
  assert.equal(added.Clients[0].id, 'uuid-b');
});

test('incomplete, stale-shaped and duplicate server responses are rejected before installation', () => {
  assert.throws(() => readServerRecords({}), /incomplete/);
  const missingWorkflow = payload();
  delete missingWorkflow.records['Client care'];
  assert.throws(() => readServerRecords(missingWorkflow), /incomplete/);
  const workflow = payload();
  workflow.records.Viewings.push({ id: 'uuid-v', version: 1, record: { client_id: 'CL-001' } });
  assert.throws(() => readServerRecords(workflow), /invalid/);
  const missingVersion = payload();
  delete missingVersion.records.Clients[0].version;
  assert.throws(() => readServerRecords(missingVersion), /invalid/);
  const duplicate = payload();
  duplicate.records.Clients.push(client('uuid-b', 1, 'CL-001', 'Duplicate'));
  assert.throws(() => readServerRecords(duplicate), /invalid/);
  assert.throws(
    () =>
      serverRecordMetadata(readServerRecords(payload()), 'Clients', {
        client_id: 'another-workspace',
      }),
    /no longer available/,
  );
});

test('only an existing-record version conflict offers a reload; duplicate IDs and linked records show their actual error', () => {
  const stale = { status: 409, details: { code: 'version_conflict' }, message: 'Stale record.' };
  assert.equal(serverMutationFailure(stale, { client_id: 'CL-001' }).conflict, true);
  assert.equal(serverMutationFailure(stale, null).conflict, false);
  for (const message of [
    'That record ID is already in use.',
    'This contact is linked to a property.',
  ]) {
    const result = serverMutationFailure({ status: 409, message }, { contact_id: 'CT-001' });
    assert.equal(result.conflict, false);
    assert.equal(result.message, message);
  }
});
