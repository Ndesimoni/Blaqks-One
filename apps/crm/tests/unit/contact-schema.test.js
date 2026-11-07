import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import * as fields from '../../src/config/fields.js';
import { descriptions, labels, nav, preferredCols } from '../../src/config/navigation.js';
import { WORKBOOK_SCHEMAS } from '../../src/data/schemas.js';
import { columnLetter } from '../../src/data/schemas/columns.js';
import { recordDetailFields, recordFormSections } from '../../src/features/records/formSections.js';
import { schema } from '../../src/lib/schema.js';

// Digests of the values exported before the schema, field and navigation modules were split.
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const without = (object, key) =>
  Object.fromEntries(Object.entries(object).filter(([k]) => k !== key));
const newColumns = ['Building / project', 'Community', 'Emirate'];
const appendedColumns = [...newColumns, 'Address', 'Map link'];
const propertyColumns = appendedColumns.slice(-2);
const earlierKeys = (section) =>
  section.fields.map((f) => f.key).filter((key) => !['address', 'map_link'].includes(key));

test('Contacts appends location, address and map link columns after Record check', () => {
  assert.deepEqual(
    WORKBOOK_SCHEMAS.Contacts.map(({ col, name }) => `${col}:${name}`),
    [
      'A:Contact ID',
      'B:Full name',
      'C:Contact type',
      'D:Company',
      'E:Phone',
      'F:Email',
      'G:Notes',
      'H:Record check',
      'I:Building / project',
      'J:Community',
      'K:Emirate',
      'L:Address',
      'M:Map link',
    ],
  );
  const properties = schema('Properties');
  for (const name of newColumns) {
    const contact = schema('Contacts').find((field) => field.name === name);
    const property = properties.find((field) => field.name === name);
    assert.deepEqual(without(contact, 'col'), without(property, 'col'));
    assert.equal(contact.calculated, false);
  }
  assert.deepEqual(schema('Contacts').find((field) => field.key === 'emirate').options, [
    'Dubai',
    'Abu Dhabi',
    'Sharjah',
    'Ajman',
    'Ras Al Khaimah',
    'Fujairah',
    'Umm Al Quwain',
  ]);
});

test('split workbook schemas keep every earlier sheet and column exactly', () => {
  const earlier = structuredClone(WORKBOOK_SCHEMAS);
  earlier.Contacts = earlier.Contacts.filter((column) => !appendedColumns.includes(column.name));
  earlier.Properties = earlier.Properties.filter((col) => !propertyColumns.includes(col.name));
  assert.equal(digest(earlier), 'b80cf7714c2a12bdace85a0ada163e29df5215b562191a99636a768c187e44cd');
  for (const columns of Object.values(WORKBOOK_SCHEMAS))
    columns.forEach((column, index) => assert.equal(column.col, columnLetter(index)));
  assert.deepEqual([0, 25, 26, 44, 701, 702].map(columnLetter), [
    'A',
    'Z',
    'AA',
    'AS',
    'ZZ',
    'AAA',
  ]);
});

test('split field options keep their order and values apart from the two new contact types', () => {
  const options = structuredClone(fields.OPTIONS);
  options['Contact type'] = options['Contact type'].filter(
    (type) => !['Security guard', 'Building manager'].includes(type),
  );
  assert.equal(digest(options), 'ba77d6d4e0dd8e138ab6716f0529ae0a2a5fd7d51f9b6f4b49a370d6316680ef');
  assert.equal(
    digest(fields.computedByModule),
    '7423205c07805205d06a885a1cf608fba82abbd3c54b0583bbd87f610a794e81',
  );
  const patterns = [fields.numRegex, fields.dateRegex, fields.longRegex];
  assert.equal(
    digest(patterns.flatMap((pattern) => [pattern.source, pattern.flags])),
    '01351be4c1796aff8022a95a92c1bb425326d33006045a5c76c95a9db3018f66',
  );
});

test('split navigation and form layouts keep every other module unchanged', () => {
  assert.equal(
    digest([nav, without(without(labels, 'Channels'), 'Inbox')]),
    '5a7a6eed2cfd96ef1056e279c5dd6b6592239c7c4c2b39e1e56786292850f0da',
  );
  assert.equal(
    digest(without(without(without(descriptions, 'Contacts'), 'Channels'), 'Inbox')),
    '5f8730fd84beb227a378bc5a85cb71c104d9a07c827cbaf75b0309afe534b032',
  );
  assert.equal(
    digest(without(preferredCols, 'Contacts')),
    '1effb1c8174570ed32de16fdfee52844b133a3ab4af025c8eb101373e2328b9f',
  );
  const forms = Object.keys(WORKBOOK_SCHEMAS)
    .filter((module) => module !== 'Contacts')
    .map((module) => [
      module,
      recordFormSections(module).map((s) => [s.id, s.title, s.media, earlierKeys(s)]),
    ]);
  assert.equal(digest(forms), 'c05d50cc2babcbf96618f3c993cec4204dffe5e43e2a1c5c8f75f8124e00251b');
});

test('the contact form places location after Company and the table shows the building', () => {
  const sections = recordFormSections('Contacts');
  assert.equal(sections.length, 1);
  assert.equal(sections[0].title, 'Contact details');
  assert.deepEqual(
    sections[0].fields.map((field) => field.key),
    [
      'contact_id',
      'full_name',
      'contact_type',
      'company',
      'building_project',
      'community',
      'emirate',
      'address',
      'map_link',
      'phone',
      'email',
      'notes',
    ],
  );
  assert.deepEqual(
    recordDetailFields('Contacts').map((field) => field.key),
    [...sections[0].fields.map((field) => field.key), 'record_check'],
  );
  for (const module of ['Clients', 'Deals'])
    assert.deepEqual(recordDetailFields(module), schema(module));
  assert.deepEqual(preferredCols.Contacts, [
    'Contact ID',
    'Full name',
    'Contact type',
    'Company',
    'Building / project',
    'Phone',
    'Email',
  ]);
});
