import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspaceRepository } from '../../src/services/storage/workspaceRepository.js';
import { createPreferencesRepository } from '../../src/services/storage/preferencesRepository.js';
import { blank } from '../../src/lib/schema.js';

function memoryStorage(entries = []) {
  const values = new Map(entries);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('existing workspace envelopes round-trip with media and unknown metadata intact', () => {
  const saved = {
    data: blank(),
    demo: false,
    createdAt: '2026-01-01T10:00:00.000Z',
    customMetadata: { importedFrom: 'existing workspace' },
  };
  saved.data.Properties.push({
    property_id: 'PR-EXISTING',
    media_photos: [{ name: 'cover.jpg', type: 'image/jpeg', src: 'data:image/jpeg;base64,test' }],
    media_floorplans: [
      { name: 'plan.pdf', type: 'application/pdf', src: 'data:application/pdf;base64,test' },
    ],
  });
  const storage = memoryStorage([['kws-crm-v1', JSON.stringify(saved)]]);
  const repository = createWorkspaceRepository(() => storage);
  const loaded = repository.load();
  assert.deepEqual(loaded, saved);
  loaded.data.Clients.push({ client_id: 'CL-001', full_name: 'Updated client' });
  repository.save(loaded);
  assert.deepEqual(JSON.parse(storage.getItem('kws-crm-v1')), loaded);
});

test('an empty browser starts with the existing demo envelope and creation timestamp', () => {
  const repository = createWorkspaceRepository(() => memoryStorage());
  const workspace = repository.load();
  assert.equal(workspace.demo, true);
  assert.equal(workspace.data.Clients[0].client_id, 'CL-001');
  assert.ok(Number.isFinite(Date.parse(workspace.createdAt)));
});

test('malformed workspace JSON reports recovery without replacing saved records', () => {
  const storage = memoryStorage([['kws-crm-v1', '{invalid json']]);
  const repository = createWorkspaceRepository(() => storage);
  assert.equal(repository.read().workspace, null);
  assert.ok(repository.read().error);
  assert.throws(() => repository.load(), /could not be opened/);
  assert.equal(storage.getItem('kws-crm-v1'), '{invalid json');
});

test('blocked access to browser storage follows each repository fallback policy', () => {
  const blockedStorage = () => {
    throw new DOMException('Storage access denied', 'SecurityError');
  };
  const repository = createWorkspaceRepository(blockedStorage);
  assert.equal(repository.read().workspace, null);
  assert.match(repository.read().error, /storage could not be read/);
  assert.deepEqual(createPreferencesRepository(blockedStorage).load(), {
    targets: {},
    theme: 'dark',
  });
});

test('write failures are propagated and never replace previously stored payloads', () => {
  const workspace = { data: blank(), demo: false };
  const preferences = { theme: 'dark', targets: {} };
  const storage = memoryStorage([
    ['kws-crm-v1', JSON.stringify(workspace)],
    ['kws-crm-preferences', JSON.stringify(preferences)],
  ]);
  const quotaError = new DOMException('No space left', 'QuotaExceededError');
  storage.setItem = () => {
    throw quotaError;
  };
  assert.throws(
    () => createWorkspaceRepository(() => storage).save({ data: blank(), demo: true }),
    (error) => error === quotaError,
  );
  assert.throws(
    () => createPreferencesRepository(() => storage).save({ theme: 'light' }),
    (error) => error === quotaError,
  );
  assert.deepEqual(JSON.parse(storage.getItem('kws-crm-v1')), workspace);
  assert.deepEqual(JSON.parse(storage.getItem('kws-crm-preferences')), preferences);
});

test('repository creation defers storage access until a read or write', () => {
  let accesses = 0;
  const storage = memoryStorage();
  const getStorage = () => {
    accesses++;
    return storage;
  };
  const workspace = createWorkspaceRepository(getStorage);
  const preferences = createPreferencesRepository(getStorage);
  assert.equal(accesses, 0);
  workspace.load();
  preferences.load();
  assert.equal(accesses, 2);
});

test('monthly targets, theme, and additional preferences round-trip unchanged', () => {
  const settings = {
    theme: 'dark',
    targets: { '2026-10': { fees: '42000', newLeads: '55' } },
    customPreference: 'existing preference',
  };
  const storage = memoryStorage([['kws-crm-preferences', JSON.stringify(settings)]]);
  const repository = createPreferencesRepository(() => storage);
  assert.deepEqual(repository.load(), settings);
  const updated = { ...repository.load(), theme: 'light' };
  repository.save(updated);
  assert.deepEqual(JSON.parse(storage.getItem('kws-crm-preferences')), updated);
  assert.deepEqual(repository.load(), updated);
});

test('missing or invalid preferences default to dark mode with independent targets', () => {
  for (const raw of [null, '', 'null', 'false', '{invalid json', '{}', '{"theme":"invalid"}']) {
    const storage = memoryStorage([['kws-crm-preferences', raw]]);
    const repository = createPreferencesRepository(() => storage);
    const first = repository.load();
    assert.deepEqual(first, { targets: {}, theme: 'dark' });
    first.targets.changed = true;
    assert.deepEqual(repository.load(), { targets: {}, theme: 'dark' });
  }
});
