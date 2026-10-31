import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contactLabel,
  findContact,
  normalizeBuilding,
  sameBuilding,
  selectBuildingContacts,
  telHref,
} from '../../src/features/properties/buildingContacts.js';

const contact = (contact_id, full_name, contact_type, building_project) => ({
  contact_id,
  full_name,
  contact_type,
  building_project,
});
const contacts = [
  contact('CT-1', 'Rana Haddad', 'Landlord', 'Marina Gate 2'),
  contact('CT-2', 'Zaid Omar', 'Broker', 'marina gate 2'),
  contact('CT-3', 'Bilal Khan', 'Building manager', '  Marina   Gate 2 '),
  contact('CT-4', 'Yusuf Ali', 'Security guard', 'MARINA GATE 2'),
  contact('CT-5', 'Amir Saleh', 'Security guard', 'Marina Gate 2'),
  contact('CT-6', 'Other tower', 'Security guard', 'Marina Gate 1'),
  contact('CT-7', 'No building', 'Building manager', ''),
];
const property = { property_id: 'PR-1', contact_id: 'CT-1', building_project: 'Marina Gate 2' };
const ids = (rows) => rows.map((row) => row.contact_id);

test('building names match case-insensitively with trimmed, collapsed whitespace', () => {
  assert.equal(normalizeBuilding('  Marina \t Gate\n2 '), 'marina gate 2');
  assert.equal(normalizeBuilding(undefined), '');
  assert.ok(sameBuilding('Marina Gate 2', ' MARINA  gate 2'));
  assert.ok(!sameBuilding('Marina Gate 2', 'Marina Gate 1'));
  assert.ok(!sameBuilding('', ''));
  assert.ok(!sameBuilding('   ', undefined));
});

test('building contacts list guards, then managers, then others by name, without the linked contact', () => {
  assert.deepEqual(ids(selectBuildingContacts(contacts, property)), [
    'CT-5',
    'CT-4',
    'CT-3',
    'CT-2',
  ]);
  const unlinked = { ...property, contact_id: '' };
  assert.deepEqual(ids(selectBuildingContacts(contacts, unlinked)).at(-1), 'CT-2');
  assert.ok(ids(selectBuildingContacts(contacts, unlinked)).includes('CT-1'));
});

test('a property without a building, or without matches, lists no building contacts', () => {
  for (const building_project of ['', '   ', undefined])
    assert.deepEqual(selectBuildingContacts(contacts, { ...property, building_project }), []);
  assert.deepEqual(
    selectBuildingContacts(contacts, { ...property, building_project: 'Unknown Tower' }),
    [],
  );
  assert.deepEqual(selectBuildingContacts(undefined, property), []);
  assert.deepEqual(selectBuildingContacts([], property), []);
});

test('hidden contacts are never listed because only loaded contacts are matched', () => {
  const visible = contacts.filter((row) => row.contact_id !== 'CT-4');
  assert.ok(!ids(selectBuildingContacts(visible, property)).includes('CT-4'));
  assert.equal(findContact(visible, 'CT-4'), null);
});

test('linked contacts resolve by trimmed ID and label as name and type', () => {
  assert.equal(findContact(contacts, ' CT-1 ').full_name, 'Rana Haddad');
  assert.equal(findContact(contacts, ''), null);
  assert.equal(findContact(contacts, 'CT-404'), null);
  assert.equal(findContact(undefined, 'CT-1'), null);
  assert.equal(contactLabel(contacts[0]), 'Rana Haddad · Landlord');
  assert.equal(contactLabel({ contact_id: 'CT-9', full_name: 'Untyped' }), 'Untyped');
  assert.equal(contactLabel({ contact_id: 'CT-9', contact_type: 'Owner' }), 'CT-9 · Owner');
});

test('phone numbers become dialable tel: links only when they contain digits', () => {
  assert.equal(telHref('+971 50 000 0192'), 'tel:+971500000192');
  assert.equal(telHref('00971 4 000 0191'), 'tel:+97140000191');
  assert.equal(telHref('(04) 000-0191'), 'tel:040000191');
  assert.equal(telHref('call reception'), '');
  assert.equal(telHref(undefined), '');
});
