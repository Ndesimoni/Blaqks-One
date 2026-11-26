import assert from 'node:assert/strict';
import test from 'node:test';
import { WORKBOOK_SCHEMAS } from '../../src/data/schemas.js';
import { recordDetailFields } from '../../src/features/records/formSections.js';
import { factSections } from '../../src/features/records/panel/factSections.js';

const CALCULATED = 'Calculated fields';
const names = (section) => section.fields.map((field) => field.name);
const sectionWith = (module, name) =>
  factSections(module, CALCULATED).find((section) => names(section).includes(name));

test('every workbook field shows exactly once, in a non-empty section', () => {
  for (const module of Object.keys(WORKBOOK_SCHEMAS)) {
    const sections = factSections(module, CALCULATED);
    const keys = sections.flatMap((section) => section.fields.map((field) => field.key));
    assert.equal(new Set(keys).size, keys.length, `${module} repeats a field`);
    assert.deepEqual(
      [...keys].sort(),
      recordDetailFields(module)
        .map((field) => field.key)
        .sort(),
      `${module} loses or adds a field`,
    );
    assert.ok(
      sections.every((section) => section.fields.length && section.title),
      module,
    );
  }
});

test('facts follow the editor sections, then calculated fields last', () => {
  const clients = factSections('Clients', CALCULATED);
  assert.deepEqual(
    clients.map((section) => section.title),
    [
      'Contact details',
      'Property requirements',
      'Budget & financing',
      'Qualification & progress',
      'Relationships & notes',
      CALCULATED,
    ],
  );
  assert.ok(clients.at(-1).fields.every((field) => field.calculated));
  assert.ok(names(clients.at(-1)).includes('Lead tier auto'));
  assert.deepEqual(names(clients[0]).slice(0, 3), ['Client ID', 'Full name', 'Phone']);
});

test('modules without a layout keep one Record information group, then scheduling', () => {
  const sections = factSections('Follow-ups', CALCULATED);
  assert.deepEqual(
    sections.map((section) => [section.id, section.title]),
    [
      ['additional', 'Record information'],
      ['schedule', 'Scheduling'],
      ['calculated', CALCULATED],
    ],
  );
  assert.deepEqual(names(sections[1]), ['Due date']);
  assert.ok(!names(sections[0]).includes('Activity type'), 'browser-only schedule fields stay out');
});

test('location fields stay together for contacts and properties', () => {
  const contact = names(sectionWith('Contacts', 'Company'));
  const at = contact.indexOf('Company');
  assert.deepEqual(contact.slice(at, at + 6), [
    'Company',
    'Building / project',
    'Community',
    'Emirate',
    'Address',
    'Map link',
  ]);
  const property = names(sectionWith('Properties', 'Unit reference'));
  const unit = property.indexOf('Unit reference');
  assert.deepEqual(property.slice(unit, unit + 3), ['Unit reference', 'Address', 'Map link']);
});

test('the calculated group is titled by the caller and omitted when a module has none', () => {
  assert.equal(factSections('Clients', 'Automatic').at(-1).title, 'Automatic');
  for (const module of Object.keys(WORKBOOK_SCHEMAS)) {
    const calculated = recordDetailFields(module).filter((field) => field.calculated);
    const last = factSections(module, CALCULATED).at(-1);
    assert.equal(last.id === 'calculated', calculated.length > 0, module);
  }
});
