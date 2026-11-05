import test from 'node:test';
import assert from 'node:assert/strict';
import { blank } from '../../src/lib/schema.js';
import { createFullBackup } from '../../src/services/files/backup.js';
import {
  savedImportSources,
  readSavedImport,
  readBackupImport,
} from '../../src/features/server/importSources.js';
import { prepareServerImport, needsMember } from '../../src/features/server/importModel.js';
import { connectedCollections } from '../../src/features/server/records.js';

const counts = (values = {}) =>
  Object.fromEntries(connectedCollections.map((name) => [name, values[name] || 0]));

// Imports belong to the company Admin (BO1a); staff and Blaqks One never read browser sources.
const owner = { role: 'Admin', roleId: 'admin', managesTeam: true };
const others = [
  { role: 'Staff', roleId: 'staff' },
  { role: 'Blaqks One', roleId: 'super-admin', managesTeam: true },
];
const organisation = 'super-admin-workspace';
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index],
    getItem: (key) => values.get(key) ?? null,
  };
}
const sourceData = () => ({
  ...blank(),
  Clients: [{ client_id: 'CL-001', custom_business_note: 'Keep this field' }],
  Contacts: [{ contact_id: 'CT-001', full_name: 'Landlord' }],
  Properties: [
    {
      property_id: 'PR-001',
      contact_id: 'CT-001',
      listing_title: 'Linked house',
      media_photos: [{ name: 'house.jpg', src: 'data:image/jpeg;base64,YQ==' }],
    },
  ],
  Viewings: [{ viewing_id: 'VW-001', client_id: 'CL-001', property_id: 'PR-001' }],
  Deals: [{ deal_id: 'DL-001' }],
});

test('only existing saved keys are offered; absent browser data never generates demo records', () => {
  assert.deepEqual(
    savedImportSources(owner, () => memoryStorage()),
    [],
  );
  const storage = memoryStorage({
    'kws-crm-v1:workspace:aidah': '{}',
    'kws-crm-preferences': '{}',
    'kws-crm-team-preview-v1': JSON.stringify({ members: [{ id: 'aidah', name: 'Aidah' }] }),
  });
  assert.deepEqual(
    savedImportSources(owner, () => storage),
    [
      {
        key: 'kws-crm-v1:workspace:aidah',
        id: 'aidah',
        label: 'Aidah · Personal browser workspace',
      },
    ],
  );
  assert.throws(
    () => readSavedImport(owner, { key: 'kws-crm-v1', id: organisation }, () => storage),
    /existing saved/,
  );
});

test('staff and Blaqks One cannot enumerate or read browser sources, whatever their labels', () => {
  let reads = 0;
  const storage = () => {
    reads++;
    return memoryStorage();
  };
  for (const member of others) {
    assert.throws(() => savedImportSources(member, storage), /company Admin/);
    assert.throws(() => readSavedImport(member, {}, storage), /company Admin/);
    assert.throws(() => readBackupImport(member, '{}', organisation, 'b.json'), /company Admin/);
  }
  assert.equal(reads, 0);
});

test('a personal source names its receiving member; the organisation set goes to the Admin', () => {
  assert.equal(needsMember(organisation), false);
  assert.equal(needsMember('aidah'), true);
  assert.equal(needsMember('backup-personal'), true);
});

test('import preparation preserves IDs, links, media and unknown business fields without changing the source', () => {
  const data = sourceData();
  const raw = JSON.stringify({
    data,
    activity: [],
    demo: true,
    password: 'excluded envelope value',
  });
  const storage = memoryStorage({ 'kws-crm-v1': raw });
  const prepared = readSavedImport(
    owner,
    savedImportSources(owner, () => storage)[0],
    () => storage,
  );
  assert.deepEqual(
    prepared.counts,
    counts({ Clients: 1, Contacts: 1, Properties: 1, Viewings: 1 }),
  );
  assert.deepEqual(prepared.deferred, { Deals: 1 });
  assert.deepEqual(Object.keys(prepared.records), connectedCollections);
  assert.equal(prepared.records.Viewings[0].property_id, 'PR-001');
  assert.equal(prepared.records.Clients[0].custom_business_note, 'Keep this field');
  assert.equal(prepared.records.Properties[0].contact_id, 'CT-001');
  assert.deepEqual(prepared.records.Properties[0].media_photos, data.Properties[0].media_photos);
  assert.equal(prepared.records.activity, undefined);
  assert.equal(prepared.records.password, undefined);
  assert.equal(storage.getItem('kws-crm-v1'), raw);
});

test('JSON backups require explicit source ownership and credential fields stop preparation', () => {
  const backup = JSON.stringify(createFullBackup(sourceData()));
  const prepared = readBackupImport(owner, backup, 'backup-personal', 'Aidah.json');
  assert.equal(prepared.sourceWorkspaceId, 'backup-personal');
  assert.match(prepared.label, /selected by you/);
  assert.equal(prepared.counts.Properties, 1);
  for (const key of [
    'password',
    'password_hash',
    'accessToken',
    'refresh_token',
    'provider_token',
    'csrfToken',
    'sessionToken',
  ]) {
    const data = sourceData();
    data.Clients[0][key] = 'do not import';
    assert.throws(() => prepareServerImport(data), /credential fields/);
  }
});
