import test from 'node:test';
import assert from 'node:assert/strict';
import { blank } from '../../src/lib/schema.js';
import { createFullBackup } from '../../src/services/files/backup.js';
import {
  savedImportSources,
  readSavedImport,
  readBackupImport,
} from '../../src/features/server/importSources.js';
import {
  prepareServerImport,
  importDestination,
  validateImportPreview,
} from '../../src/features/server/importModel.js';

const owner = { role: 'Super Admin', roleId: 'super-admin', managesTeam: true };
const member = { role: 'Admin', roleId: 'admin', managesTeam: true };
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

test('server Admins cannot enumerate or read browser sources even when preview role labels claim ownership', () => {
  let reads = 0;
  const storage = () => {
    reads++;
    return memoryStorage();
  };
  assert.throws(() => savedImportSources(member, storage), /Super Admin/);
  assert.throws(() => readSavedImport(member, {}, storage), /Super Admin/);
  assert.throws(() => readBackupImport(member, '{}', organisation, 'backup.json'), /Super Admin/);
  assert.equal(reads, 0);
});

test('organisation sources stay locked to their owner and personal destination mapping is explicit', () => {
  assert.equal(importDestination(organisation, 'aidah-server'), organisation);
  assert.equal(importDestination('aidah', 'aidah-server'), 'aidah-server');
  assert.equal(importDestination('backup-personal', 'simoni-server'), 'simoni-server');
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
  assert.deepEqual(prepared.counts, { Clients: 1, Contacts: 1, Properties: 1 });
  assert.deepEqual(prepared.deferred, { Deals: 1 });
  assert.deepEqual(Object.keys(prepared.records), ['Clients', 'Contacts', 'Properties']);
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

test('malformed server import previews cannot enable the commit action', () => {
  assert.throws(() => validateImportPreview({ token: 'a', expiresAt: 'tomorrow' }), /incomplete/);
  const preview = {
    token: 'a',
    expiresAt: new Date().toISOString(),
    counts: { Clients: 1, Contacts: 1, Properties: 1 },
    skipped: { Clients: 0, Contacts: 0, Properties: 0 },
  };
  assert.equal(validateImportPreview(preview), preview);
});
