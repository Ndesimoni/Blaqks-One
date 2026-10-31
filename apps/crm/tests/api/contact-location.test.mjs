import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create, recordsPath } from './helpers.mjs';
import { commit, emptyRecords, fixtures, planned, preview } from './import-helpers.mjs';

const SCALAR = 'Workbook fields must contain scalar values.';
const FIELDS = ['building_project', 'community', 'emirate'];
const location = {
  building_project: 'Marina Gate Tower 2',
  community: 'Dubai Marina',
  emirate: 'Dubai',
};

let owner, admin;
before(async () => ({ owner, admin } = await fixtures()));

const contactsOf = async (session, workspace) =>
  (await session.request(`/workspaces/${workspace}/records`)).value.records.Contacts;

test('Contacts persist building, community, emirate and new contact types', async () => {
  const created = await create(admin, 'Contacts', {
    full_name: 'Synthetic guard',
    contact_type: 'Security guard',
    ...location,
  });
  assert.equal(created.record.contact_type, 'Security guard');
  for (const field of FIELDS) assert.equal(created.record[field], location[field]);
  const path = recordsPath(admin, 'Contacts', created.id);
  const moved = { building_project: 'Burj Vista', community: 'Downtown Dubai', emirate: 'Dubai' };
  const updated = await admin.request(path, {
    method: 'PATCH',
    body: {
      record: { ...created.record, ...moved, contact_type: 'Building manager' },
      version: created.version,
    },
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.value));
  assert.equal(updated.value.record.contact_type, 'Building manager');
  const stored = (await contactsOf(admin, admin.user.id)).find((row) => row.id === created.id);
  for (const field of FIELDS) assert.equal(stored.record[field], moved[field]);
  assert.equal(stored.record.contact_type, 'Building manager');
});

test('nested location values are rejected on create, update and import', async () => {
  const base = await create(admin, 'Contacts', { full_name: 'Synthetic manager' });
  const path = recordsPath(admin, 'Contacts', base.id);
  for (const field of FIELDS) {
    for (const value of [['Dubai'], { name: 'Dubai' }]) {
      const created = await admin.request(recordsPath(admin, 'Contacts'), {
        method: 'POST',
        body: { record: { full_name: 'Rejected', [field]: value } },
      });
      assert.equal(created.status, 400);
      assert.equal(created.value.message, SCALAR);
      const updated = await admin.request(path, {
        method: 'PATCH',
        body: { record: { ...base.record, [field]: value }, version: base.version },
      });
      assert.equal(updated.status, 400);
      assert.equal(updated.value.message, SCALAR);
    }
  }
  const records = {
    ...emptyRecords(),
    Contacts: [{ contact_id: 'LOC-BAD', full_name: 'Rejected', community: ['Marina'] }],
  };
  const rejected = await preview(owner, admin.user.id, records);
  assert.equal(rejected.status, 400);
  assert.equal(rejected.value.message, SCALAR);
});

test('Super Admin import preserves Contact location fields', async () => {
  const records = {
    ...emptyRecords(),
    Contacts: [
      {
        contact_id: 'LOC-IMPORT',
        full_name: 'Synthetic imported guard',
        contact_type: 'Security guard',
        ...location,
      },
    ],
  };
  const plan = await planned(owner, admin.user.id, records);
  const result = await commit(owner, admin.user.id, plan.token);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.equal(result.value.imported.Contacts, 1);
  const contact = (await contactsOf(owner, admin.user.id)).find(
    (row) => row.record.contact_id === 'LOC-IMPORT',
  );
  assert.equal(contact.record.contact_type, 'Security guard');
  for (const field of FIELDS) assert.equal(contact.record[field], location[field]);
});
