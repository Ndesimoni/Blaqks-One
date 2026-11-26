import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultPropertyFilters,
  detailsColumn,
  matchesPropertyPreset,
  propertyPresets,
} from '../../src/features/properties/selectors.js';

// Clearly fictional listings.
const listings = [
  { property_id: 'P1', listing_status: 'Available', sale_rental: 'Sale' },
  { property_id: 'P2', listing_status: 'Rented', sale_rental: 'Rental' },
];
const ids = (preset) =>
  listings.filter((p) => matchesPropertyPreset(p, preset)).map((p) => p.property_id);

test("Properties open on All listings; the mockup's Available and the purposes follow", () => {
  const labels = propertyPresets.map(({ label }) => label);
  assert.deepEqual(labels.slice(0, 2), ['All listings', 'Available']);
  assert.ok(labels.includes('For sale') && labels.includes('For rent'));
  // A listing without a status must not vanish on reload.
  assert.equal(defaultPropertyFilters().purpose, 'All');
  assert.deepEqual(ids('Available'), ['P1']);
  assert.deepEqual(ids('Rental'), ['P2']);
  assert.deepEqual(ids('All'), ['P1', 'P2']);
});

test('the Details column reads bed · size · community', () => {
  const property = { bedrooms: '2', area_sq_ft: '1240', community: 'Dubai Marina' };
  assert.equal(detailsColumn.value(property), '2 bed · 1,240 sq ft · Dubai Marina');
  assert.equal(detailsColumn.value({ community: 'JLT' }), 'JLT');
  assert.equal(detailsColumn.virtual, true);
});
