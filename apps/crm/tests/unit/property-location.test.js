import assert from 'node:assert/strict';
import test from 'node:test';
import { WORKBOOK_SCHEMAS } from '../../src/data/schemas.js';
import { recordDetailFields, recordFormSections } from '../../src/features/records/formSections.js';
import { validateRecord } from '../../src/features/records/validation.js';
import { detailLink } from '../../src/lib/detailLinks.js';
import { schema } from '../../src/lib/schema.js';

const field = (key) => schema('Properties').find((candidate) => candidate.key === key);
const unsafe = ['javascript:alert(1)', 'data:text/html,x', 'www.example.com/x', '', undefined];

test('Properties append Address and Map link after Viewing instructions', () => {
  const columns = WORKBOOK_SCHEMAS.Properties.map(({ col, name }) => `${col}:${name}`);
  assert.equal(columns.length, 41);
  assert.deepEqual(columns.slice(-3), ['AM:Viewing instructions', 'AN:Address', 'AO:Map link']);
  assert.deepEqual(columns.slice(0, 3), ['A:Property ID', 'B:Listing title', 'C:Contact ID']);
  assert.equal(field('address').type, 'text');
  assert.equal(field('address').calculated, false);
  assert.equal(field('map_link').type, 'url');
  assert.equal(field('map_link').placeholder, 'https://maps.google.com/…');
  const contact = schema('Contacts').find((candidate) => candidate.key === 'map_link');
  assert.deepEqual({ ...field('map_link'), col: '' }, { ...contact, col: '' });
});

test('the property form and details place Address and Map link after Unit reference', () => {
  const location = recordFormSections('Properties').find((s) => s.id === 'specifications');
  assert.equal(location.title, 'Location & specifications');
  const keys = location.fields.map((f) => f.key);
  assert.deepEqual(keys.slice(0, 6), [
    'emirate',
    'community',
    'building_project',
    'unit_reference',
    'address',
    'map_link',
  ]);
  const details = recordDetailFields('Properties').map((f) => f.key);
  const at = details.indexOf('unit_reference');
  assert.deepEqual(details.slice(at, at + 3), ['unit_reference', 'address', 'map_link']);
  assert.deepEqual(
    [...details].sort(),
    schema('Properties')
      .map((f) => f.key)
      .sort(),
  );
  assert.equal(details.at(-1), 'viewing_instructions');
});

test('property Map link validation accepts http(s) links only', () => {
  const error = (map_link) =>
    validateRecord('Properties', { property_id: 'PR-A1', map_link }).map_link;
  assert.equal(error('https://maps.google.com/?q=Marina'), undefined);
  assert.equal(error('http://maps.example.com/place'), undefined);
  for (const value of ['javascript:alert(1)', 'maps.google.com/?q=x', 'Dubai Marina'])
    assert.equal(error(value), 'Enter a complete http:// or https:// URL.', value);
});

test('property detail links label safe map, listing and photo URLs and leave others as text', () => {
  const cases = {
    map_link: ['https://maps.google.com/?q=Marina', 'Open map'],
    listing_url: ['https://example.com/listing/1', 'Open listing'],
    photos_documents_url: ['http://example.com/photos', 'Open photos & documents'],
  };
  for (const [key, [href, label]] of Object.entries(cases)) {
    assert.deepEqual(detailLink(field(key), href), { href, label });
    for (const value of unsafe) assert.equal(detailLink(field(key), value), null, String(value));
  }
  for (const key of ['address', 'virtual_tour_url', 'floor_plan_url', 'notes'])
    assert.equal(detailLink(field(key), 'https://example.com/x'), null, key);
});
