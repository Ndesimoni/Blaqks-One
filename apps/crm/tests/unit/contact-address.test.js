import assert from 'node:assert/strict';
import test from 'node:test';
import { WORKBOOK_SCHEMAS } from '../../src/data/schemas.js';
import { validateRecord } from '../../src/features/records/validation.js';
import { detailLink } from '../../src/lib/detailLinks.js';
import { blank, schema } from '../../src/lib/schema.js';
import { selectRecords } from '../../src/lib/workspace.js';

const field = (key) => schema('Contacts').find((candidate) => candidate.key === key);
const mapError = (map_link) =>
  validateRecord('Contacts', { contact_id: 'CT-A1', map_link }).map_link;

test('Address is free text and Map link is a URL field with a map placeholder', () => {
  assert.equal(field('address').type, 'text');
  assert.equal(field('address').placeholder, undefined);
  assert.equal(field('map_link').type, 'url');
  assert.equal(field('map_link').placeholder, 'https://maps.google.com/…');
  const others = Object.keys(WORKBOOK_SCHEMAS).flatMap((module) =>
    schema(module).filter(
      (candidate) => 'placeholder' in candidate && candidate.key !== 'map_link',
    ),
  );
  assert.deepEqual(others, []);
  assert.equal(
    schema('Properties').find((candidate) => candidate.key === 'virtual_tour_url').type,
    'url',
  );
});

test('Map link accepts complete http(s) links and rejects scripts or schemeless text', () => {
  for (const value of [
    'https://maps.google.com/?q=Marina%20Gate%202',
    'https://goo.gl/maps/abc123',
    'http://maps.example.com/place',
    '',
    undefined,
  ])
    assert.equal(mapError(value), undefined, String(value));
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,map',
    'maps.google.com/?q=Marina',
    'www.google.com/maps',
    'Dubai Marina',
  ])
    assert.equal(mapError(value), 'Enter a complete http:// or https:// URL.', value);
  const address = 'Unit 1203, Tower 2, Marina Gate, Dubai Marina';
  assert.deepEqual(validateRecord('Contacts', { contact_id: 'CT-A1', address }), {});
});

test('detail links open only safe configured map links', () => {
  assert.deepEqual(detailLink(field('map_link'), 'https://maps.google.com/?q=Creek%20Vista'), {
    href: 'https://maps.google.com/?q=Creek%20Vista',
    label: 'Open map',
  });
  for (const value of [
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,map',
    'maps.google.com/x',
    '',
    undefined,
    null,
  ])
    assert.equal(detailLink(field('map_link'), value), null, String(value));
  assert.equal(detailLink(field('address'), 'https://maps.google.com/'), null);
  const tour = schema('Properties').find((candidate) => candidate.key === 'virtual_tour_url');
  assert.equal(detailLink(tour, 'https://example.com/tour'), null);
});

test('contact search matches address text without adding the columns to tables', () => {
  const data = blank();
  data.Contacts = [
    {
      contact_id: 'CT-1',
      full_name: 'Front desk',
      address: 'Unit 1203, Tower 2, Marina Gate',
      map_link: 'https://maps.google.com/?q=Marina',
    },
    { contact_id: 'CT-2', full_name: 'Gate guard', address: 'Gate 4, Creek Vista' },
  ];
  const find = (query) =>
    selectRecords(data, 'Contacts', { query }).map((record) => record.contact_id);
  assert.deepEqual(find('tower 2'), ['CT-1']);
  assert.deepEqual(find(' GATE 4 '), ['CT-2']);
  assert.deepEqual(find('gate'), ['CT-1', 'CT-2']);
});
