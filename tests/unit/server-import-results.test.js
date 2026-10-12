import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImportResult } from '../../src/features/server/importModel.js';

test('an ambiguous commit response keeps recovery on the same import instead of claiming success', () => {
  assert.throws(() => validateImportResult({}), /Retry to check the same import/);
  assert.throws(
    () => validateImportResult({ replayed: false, imported: { Clients: '1' }, skipped: {} }),
    /incomplete/,
  );
  const result = {
    replayed: true,
    imported: { Clients: 1, Contacts: 2, Properties: 3 },
    skipped: { Clients: 0, Contacts: 1, Properties: 0 },
  };
  assert.equal(validateImportResult(result), result);
});
