import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanColumns,
  defaultColumns,
  sameColumns,
  toggleColumn,
} from '../../src/features/records/grid/columnsModel.js';
import { directoryNoun, plural } from '../../src/features/records/grid/directoryNouns.js';
import { schema } from '../../src/lib/schema.js';

const names = (module) => schema(module).map((field) => field.name);

test('every directory starts on columns that exist in its sheet, identity first', () => {
  for (const module of ['Clients', 'Contacts', 'Shortlist', 'Client care', 'Follow-ups']) {
    const columns = defaultColumns(module);
    assert.ok(columns.length > 2, module);
    assert.equal(columns[0], names(module)[0], `${module} leads with its ID`);
    for (const name of columns) assert.ok(names(module).includes(name), `${module}: ${name}`);
  }
  // The approved mockup's columns: Client, Phone, Last contact; Contact, Role, Phone, Linked to.
  assert.deepEqual(defaultColumns('Clients').slice(1), ['Full name', 'Phone', 'Last contact auto']);
  assert.equal(defaultColumns('Contacts').length, 5);
});

test('a remembered choice keeps known columns, leads with the ID and never breaks the page', () => {
  const sheet = names('Contacts');
  const fallback = defaultColumns('Contacts');
  assert.deepEqual(cleanColumns(['Email', 'Contact ID', 'Phone'], sheet, fallback), [
    'Contact ID',
    'Email',
    'Phone',
  ]);
  assert.deepEqual(cleanColumns(['Phone', 'Retired column', 'Phone', 7], sheet, fallback), [
    'Contact ID',
    'Phone',
  ]);
  for (const saved of [null, 'Phone', {}, [], ['Retired column']])
    assert.equal(cleanColumns(saved, sheet, fallback), fallback);
});

test('ticking appends a column, unticking removes it and the ID column stays', () => {
  const start = ['Client ID', 'Full name'];
  assert.deepEqual(toggleColumn(start, 'Phone', 'Client ID'), ['Client ID', 'Full name', 'Phone']);
  assert.deepEqual(toggleColumn(start, 'Full name', 'Client ID'), ['Client ID']);
  assert.equal(toggleColumn(start, 'Client ID', 'Client ID'), start);
  assert.equal(sameColumns(start, ['Client ID', 'Full name']), true);
  assert.equal(sameColumns(start, ['Full name', 'Client ID']), false);
  assert.equal(sameColumns(start, ['Client ID']), false);
});

test('directory nouns read as English in counts and presets', () => {
  assert.equal(plural(directoryNoun('Shortlist')), 'matches');
  assert.equal(plural(directoryNoun('Clients')), 'clients');
  assert.equal(plural(directoryNoun('Interaction log')), 'conversations');
  assert.equal(plural(directoryNoun('Client care')), 'touchpoints');
  assert.equal(plural(directoryNoun('Follow-ups')), 'follow-ups');
  assert.equal(plural(directoryNoun('Unknown sheet')), 'records');
  assert.equal(plural('lead'), 'leads');
});
