import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// The CRM client spreads every route file into one object, so a name defined twice
// silently replaces the earlier one (as `createAgreement` once did for commission
// agreements). Every method name must be unique across src/services/crm.
test('no two CRM route files define the same method name', () => {
  const dir = new URL('../../src/services/crm/', import.meta.url);
  const owners = new Map();
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.js'))) {
    const source = readFileSync(new URL(file, dir), 'utf8');
    for (const [, name] of source.matchAll(/^ {4}([a-zA-Z]+): /gm)) {
      const seen = owners.get(name);
      assert.ok(!seen || seen === file, `${name} is defined in ${seen} and ${file}`);
      owners.set(name, file);
    }
  }
  assert.ok(owners.has('createAgreement') && owners.has('createDealAgreement'));
});
