import test from 'node:test';
import assert from 'node:assert/strict';
import { blank } from '../../src/lib/schema.js';
import { createFullBackup, parseFullBackup } from '../../src/services/files/backup.js';
import { savedImportSources, readSavedImport } from '../../src/features/server/importSources.js';
import { importDestination } from '../../src/features/server/importModel.js';

test('a source download retains every collection in the established full-backup format', () => {
  const data = {
    ...blank(),
    Clients: [{ client_id: 'CL-001' }],
    Deals: [{ deal_id: 'DL-001' }],
    Viewings: [{ viewing_id: 'VW-001' }],
  };
  const raw = JSON.stringify({ data, demo: true, activity: [] });
  const storage = {
    length: 1,
    key: () => 'kws-crm-v1',
    getItem: (key) => (key === 'kws-crm-v1' ? raw : null),
  };
  const user = { role: 'Super Admin', roleId: 'super-admin', managesTeam: true };
  const source = readSavedImport(user, savedImportSources(user, () => storage)[0], () => storage);
  const backup = createFullBackup(source.fullData);
  assert.equal(backup.format, 'keys-with-simoni-full-backup');
  assert.equal(backup.version, 2);
  assert.deepEqual(parseFullBackup(JSON.stringify(backup)), data);
  assert.equal(backup.activity, undefined);
  assert.equal(source.records.Deals, undefined);
  assert.equal(storage.getItem('kws-crm-v1'), raw);
});

test('personal imports cannot default to the organisation destination', () => {
  assert.equal(importDestination('aidah', 'super-admin-workspace'), '');
  assert.equal(importDestination('backup-personal', 'super-admin-workspace'), '');
  assert.equal(importDestination('aidah', 'real-aidah'), 'real-aidah');
});
