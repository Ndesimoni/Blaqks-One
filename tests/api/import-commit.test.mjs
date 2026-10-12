import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create } from './helpers.mjs';
import {
  activityCount,
  commit,
  counts,
  emptyRecords,
  fixtures,
  planned,
  preview,
  recordCount,
  zeroCounts,
} from './import-helpers.mjs';

let owner, admin;
before(async () => ({ owner, admin } = await fixtures()));

test('commit retains normalized workbook IDs, private metadata and inline photos', async () => {
  const photo = {
    name: 'Synthetic.png',
    type: 'image/png',
    src: 'data:image/png;base64,iVBORw0KGgo=',
  };
  const records = {
    ...emptyRecords(),
    Clients: [
      { client_id: ' IMP-CLIENT ', full_name: 'Synthetic lead', extra: { import_code: 42 } },
    ],
    Contacts: [{ contact_id: ' IMP-CONTACT ', full_name: 'Synthetic landlord' }],
    Properties: [
      { property_id: ' IMP-PROPERTY ', contact_id: ' IMP-CONTACT ', media_photos: [photo] },
    ],
  };
  const plan = await planned(owner, admin.user.id, records);
  const result = await commit(owner, admin.user.id, plan.token);
  assert.equal(result.status, 200);
  assert.deepEqual(result.value.imported, counts({ Clients: 1, Contacts: 1, Properties: 1 }));
  assert.deepEqual(result.value.skipped, zeroCounts);
  const list = await owner.request(`/workspaces/${admin.user.id}/records`);
  const client = list.value.records.Clients.find(
    (entry) => entry.record.client_id === 'IMP-CLIENT',
  );
  const property = list.value.records.Properties.find(
    (entry) => entry.record.property_id === 'IMP-PROPERTY',
  );
  assert.equal(client.record.extra.import_code, 42);
  assert.equal(property.record.contact_id, 'IMP-CONTACT');
  assert.deepEqual(property.record.media_photos, [photo]);
  const repeated = await planned(owner, admin.user.id, records);
  assert.deepEqual(repeated.counts, zeroCounts);
  assert.deepEqual(repeated.skipped, counts({ Clients: 1, Contacts: 1, Properties: 1 }));
  const before = activityCount(admin.user.id);
  assert.equal((await commit(owner, admin.user.id, repeated.token)).status, 200);
  assert.equal(activityCount(admin.user.id), before);
});

test('different payload with the same legacy ID blocks the whole add-only import', async () => {
  await create(admin, 'Clients', { client_id: 'IMP-CONFLICT', full_name: 'Keep original' });
  const response = await preview(owner, admin.user.id, {
    ...emptyRecords(),
    Clients: [
      { client_id: 'IMP-CONFLICT', full_name: 'Unexpected overwrite' },
      { client_id: 'IMP-CONFLICT-NEW' },
    ],
  });
  assert.equal(response.status, 409);
  assert.equal(response.value.code, 'import_conflict');
  assert.equal(recordCount(admin.user.id, 'IMP-CONFLICT-NEW'), 0);
});

test('a CRUD mutation after preview requires a fresh target snapshot', async () => {
  const records = { ...emptyRecords(), Clients: [{ client_id: 'IMP-STALE-PENDING' }] };
  const plan = await planned(owner, admin.user.id, records);
  await create(admin, 'Clients', { client_id: 'IMP-STALE-CHANGE' });
  const response = await commit(owner, admin.user.id, plan.token);
  assert.equal(response.status, 409);
  assert.equal(response.value.code, 'import_conflict');
  assert.equal(recordCount(admin.user.id, 'IMP-STALE-PENDING'), 0);
  const fresh = await planned(owner, admin.user.id, records);
  assert.equal((await commit(owner, admin.user.id, fresh.token)).status, 200);
});

test('concurrent commits replay one completed transaction without duplicate records or audit', async () => {
  const records = {
    ...emptyRecords(),
    Clients: [
      {
        client_id: 'IMP-CONCURRENT',
        email: 'private-import@crm-fixture.test',
        notes: 'private body never in audit',
      },
    ],
  };
  const plan = await planned(owner, admin.user.id, records);
  const before = activityCount(admin.user.id);
  const responses = await Promise.all([
    commit(owner, admin.user.id, plan.token),
    commit(owner, admin.user.id, plan.token),
  ]);
  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200],
  );
  assert.deepEqual(responses.map((response) => response.value.replayed).sort(), [false, true]);
  assert.equal(recordCount(admin.user.id, 'IMP-CONCURRENT'), 1);
  assert.equal(activityCount(admin.user.id), before + 1);
  const history = await owner.request(`/workspaces/${admin.user.id}/activity`);
  const serialized = JSON.stringify(history.value);
  assert.ok(!serialized.includes('private-import@crm-fixture.test'));
  assert.ok(!serialized.includes('private body never in audit'));
  const replay = await commit(owner, admin.user.id, plan.token);
  assert.equal(replay.status, 200);
  assert.equal(replay.value.replayed, true);
  assert.equal(activityCount(admin.user.id), before + 1);
});
