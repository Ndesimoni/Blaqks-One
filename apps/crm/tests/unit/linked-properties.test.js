import assert from 'node:assert/strict';
import test from 'node:test';
import {
  propertySummary,
  selectBuildingProperties,
  selectLinkedProperties,
} from '../../src/features/contacts/linkedProperties.js';

const property = (property_id, contact_id, building_project, extras = {}) => ({
  property_id,
  contact_id,
  building_project,
  ...extras,
});
const properties = [
  property('PR-10', 'CT-1', 'Marina Gate 2'),
  property('PR-2', 'CT-1', 'Creek Vista'),
  property('PR-3', 'CT-2', ' marina  GATE 2'),
  property('PR-4', 'CT-2', 'Marina Gate 1'),
  property('PR-5', ' CT-1 ', ''),
];
const ids = (rows) => rows.map((row) => row.property_id);
const landlord = { contact_id: 'CT-1', building_project: 'Marina Gate 2' };

test('a contact lists the loaded properties linked to it in property ID order', () => {
  assert.deepEqual(ids(selectLinkedProperties(properties, landlord)), ['PR-2', 'PR-5', 'PR-10']);
  assert.deepEqual(selectLinkedProperties(properties, { contact_id: 'CT-404' }), []);
  assert.deepEqual(selectLinkedProperties(properties, { contact_id: '' }), []);
  assert.deepEqual(selectLinkedProperties(undefined, landlord), []);
});

test('properties in the contact building exclude those already linked to it', () => {
  assert.deepEqual(ids(selectBuildingProperties(properties, landlord)), ['PR-3']);
  const guard = { contact_id: 'CT-G', building_project: 'MARINA GATE 2 ' };
  assert.deepEqual(ids(selectBuildingProperties(properties, guard)), ['PR-3', 'PR-10']);
  for (const building_project of ['', '  ', undefined])
    assert.deepEqual(selectBuildingProperties(properties, { ...guard, building_project }), []);
});

test('hidden properties are never listed because only loaded properties are matched', () => {
  const visible = properties.filter((row) => row.property_id !== 'PR-2');
  assert.deepEqual(ids(selectLinkedProperties(visible, landlord)), ['PR-5', 'PR-10']);
});

test('property summaries show ID, building, community, status and type without repeats', () => {
  const full = property('PR-1', 'CT-1', 'Marina Gate 2', {
    community: 'Dubai Marina',
    listing_status: 'Available',
    property_type: 'Apartment',
  });
  assert.equal(
    propertySummary(full),
    'PR-1 · Marina Gate 2 · Dubai Marina · Available · Apartment',
  );
  const repeated = { property_id: 'PR-2', building_project: 'JVC', community: 'jvc' };
  assert.equal(propertySummary(repeated), 'PR-2 · JVC');
  assert.equal(propertySummary({ property_id: 'PR-3' }), 'PR-3');
});
