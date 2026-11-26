import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateImportPreview,
  validateImportResult,
} from '../../src/features/server/importModel.js';
import { connectedCollections } from '../../src/features/server/records.js';

const counts = (values = {}) =>
  Object.fromEntries(connectedCollections.map((name) => [name, values[name] || 0]));

test('an ambiguous commit response keeps recovery on the same import instead of claiming success', () => {
  assert.throws(() => validateImportResult({}), /Retry to check the same import/);
  assert.throws(
    () => validateImportResult({ replayed: false, imported: { Clients: '1' }, skipped: {} }),
    /incomplete/,
  );
  const result = {
    replayed: true,
    imported: counts({ Clients: 1, Contacts: 2, Properties: 3, 'Follow-ups': 4 }),
    skipped: counts({ Contacts: 1 }),
  };
  assert.equal(validateImportResult(result), result);
});

test('malformed server import previews cannot enable the commit action', () => {
  assert.throws(() => validateImportPreview({ token: 'a', expiresAt: 'tomorrow' }), /incomplete/);
  const preview = {
    token: 'a',
    expiresAt: new Date().toISOString(),
    counts: counts({ Clients: 1, Contacts: 1, Properties: 1 }),
    skipped: counts(),
  };
  assert.equal(validateImportPreview(preview), preview);
  const legacy = { ...preview, counts: { Clients: 1, Contacts: 1, Properties: 1 } };
  assert.throws(() => validateImportPreview(legacy), /incomplete/);
});
