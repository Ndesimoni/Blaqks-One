import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanColumns,
  defaultColumns,
  mockupGrids,
  sameColumns,
  toggleColumn,
} from '../../src/features/records/grid/columnsModel.js';
import { directoryNoun, plural } from '../../src/features/records/grid/directoryNouns.js';
import { schema } from '../../src/lib/schema.js';

const names = (module) => schema(module).map((field) => field.name);

test("every directory starts on its sheet's columns; mockup grids leave the ID out", () => {
  for (const module of ['Clients', 'Contacts', 'Shortlist', 'Client care', 'Follow-ups']) {
    const columns = defaultColumns(module);
    assert.ok(columns.length > 2, module);
    // Agent is added by connected Clients from each client's assignment, not stored.
    for (const name of columns)
      assert.ok(names(module).includes(name) || name === 'Agent', `${module}: ${name}`);
    const grid = mockupGrids.has(module);
    assert.equal(columns.includes(names(module)[0]), !grid, `${module} ID column`);
  }
  // The approved mockup's columns: Client, Phone, Agent, Last contact; Contact, Role, Phone, Linked to.
  assert.deepEqual(defaultColumns('Clients'), ['Full name', 'Phone', 'Agent', 'Last contact auto']);
  assert.equal(defaultColumns('Contacts').length, 4);
});

test('a remembered choice keeps known columns, a fixed ID leads and nothing breaks the page', () => {
  const sheet = names('Contacts');
  const fallback = defaultColumns('Contacts');
  const saved = ['Email', 'Contact ID', 'Phone'];
  assert.deepEqual(cleanColumns(saved, sheet, fallback, 'Contact ID'), [
    'Contact ID',
    'Email',
    'Phone',
  ]);
  assert.deepEqual(cleanColumns(saved, sheet, fallback, null), saved, 'a mockup grid keeps order');
  assert.deepEqual(cleanColumns(['Phone', 'Retired column', 'Phone', 7], sheet, fallback), [
    'Phone',
  ]);
  for (const saved of [null, 'Phone', {}, [], ['Retired column']])
    assert.equal(cleanColumns(saved, sheet, fallback), fallback);
});

test('ticking appends a column; unticking removes it but never a fixed ID or the last column', () => {
  const start = ['Client ID', 'Full name'];
  assert.deepEqual(toggleColumn(start, 'Phone', 'Client ID'), ['Client ID', 'Full name', 'Phone']);
  assert.deepEqual(toggleColumn(start, 'Full name', 'Client ID'), ['Client ID']);
  assert.equal(toggleColumn(start, 'Client ID', 'Client ID'), start);
  assert.deepEqual(toggleColumn(start, 'Client ID', null), ['Full name']);
  assert.deepEqual(toggleColumn(['Full name'], 'Full name', null), ['Full name']);
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
