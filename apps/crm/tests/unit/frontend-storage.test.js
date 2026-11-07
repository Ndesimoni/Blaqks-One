import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeEnvelope } from '../../src/lib/validation.js';
import { blank } from '../../src/lib/schema.js';
import { createFullBackup, parseFullBackup } from '../../src/services/files/backup.js';
import { createWorkspaceRepository } from '../../src/services/storage/workspaceRepository.js';

test('validated storage reads preserve malformed data and report blocked storage without a demo replacement', () => {
  for (const raw of [
    '{bad json',
    'null',
    JSON.stringify({ data: { Clients: {} } }),
    JSON.stringify({ data: { Clients: [null] } }),
  ]) {
    let writes = 0;
    const result = createWorkspaceRepository(() => ({
      getItem: () => raw,
      setItem: () => writes++,
    })).read();
    assert.equal(result.workspace, null);
    assert.ok(result.error);
    assert.equal(result.raw, raw);
    assert.equal(writes, 0);
  }
  const blocked = createWorkspaceRepository(() => {
    throw Error('Blocked');
  }).read();
  assert.equal(blocked.raw, null);
  assert.ok(blocked.error);
});
test('valid envelopes retain metadata, fill missing module arrays and reject invalid fields/duplicate IDs', () => {
  const record = { client_id: 'CL-1', full_name: 'Existing', extra: 'Preserved' };
  const normalized = normalizeEnvelope({
    data: { Clients: [record] },
    demo: false,
    metadata: { origin: 'old' },
  });
  assert.deepEqual(normalized.data.Properties, []);
  assert.equal(normalized.data.Clients[0], record);
  assert.deepEqual(normalized.metadata, { origin: 'old' });
  for (const clients of [[{ client_id: 'CL-1', full_name: {} }], [record, record], [{}]])
    assert.throws(() => normalizeEnvelope({ data: { Clients: clients } }));
});
test('backup validation round-trips media and rejects unsupported versions and invalid module data', () => {
  const data = blank();
  data.Properties.push({
    property_id: 'PR-1',
    media_photos: [
      { name: 'photo.jpg', src: 'data:image/jpeg;base64,dGVzdA==', type: 'image/jpeg' },
    ],
  });
  const backup = createFullBackup(data, '2026-10-08');
  assert.deepEqual(parseFullBackup(JSON.stringify(backup)), data);
  assert.throws(() => parseFullBackup(JSON.stringify({ ...backup, version: 99 })), /version/);
  assert.throws(
    () => parseFullBackup(JSON.stringify({ ...backup, data: { ...data, Clients: {} } })),
    /Clients/,
  );
  assert.throws(() => parseFullBackup('{bad json'));
  data.Properties[0].media_photos[0].src = 'javascript:alert(1)';
  assert.throws(() => parseFullBackup(JSON.stringify(backup)), /media/);
});
