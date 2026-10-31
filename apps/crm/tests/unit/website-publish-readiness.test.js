import test from 'node:test';
import assert from 'node:assert/strict';
import { isReady, readiness } from '../../src/features/server/website/publish/publishModel.js';
import { publicFacts } from '../../src/features/server/website/publish/publishView.js';
import { ready } from './website-publish-fixtures.js';

const failing = (record) =>
  readiness(record)
    .filter((rule) => !rule.ok)
    .map((rule) => rule.id);

test('a complete Available sale is ready', () => {
  assert.deepEqual(failing(ready), []);
  assert.equal(isReady({ ...ready, listing_status: 'Under offer' }), true);
});

test('each readiness rule reports its own problem', () => {
  const cases = [
    ['status', { listing_status: 'Sold' }],
    ['purpose', { sale_rental: '' }],
    ['emirate', { emirate: 'Doha' }],
    ['price', { price_annual_rent_aed: 0 }],
    ['price', { area_sq_ft: '' }],
    ['basis', { price_basis: 'Monthly' }],
    ['ready', { ready_off_plan: '' }],
    ['location', { unit_reference: ' ' }],
    ['location', { building_project: '' }],
    ['copy', { property_description: '' }],
  ];
  for (const [rule, change] of cases)
    assert.deepEqual(failing({ ...ready, ...change }), [rule], JSON.stringify(change));
});

test('price basis follows the purpose; holiday homes need nightly prices, guests and stays', () => {
  assert.deepEqual(failing({ ...ready, sale_rental: 'Rental', price_basis: 'Annual' }), []);
  assert.deepEqual(failing({ ...ready, sale_rental: 'Rental', price_basis: '' }), []);
  assert.deepEqual(failing({ ...ready, sale_rental: 'Rental', price_basis: 'Total price' }), [
    'basis',
  ]);
  const holiday = { ...ready, sale_rental: 'Holiday home', price_basis: 'Nightly' };
  assert.deepEqual(failing(holiday), ['holiday']);
  assert.deepEqual(failing({ ...holiday, maximum_guests: 4, minimum_stay_nights: '2' }), []);
  assert.deepEqual(
    failing({ ...holiday, price_basis: '', maximum_guests: 4, minimum_stay_nights: 2 }),
    ['basis'],
  );
});

test('the public preview projects allowlisted facts only', () => {
  const facts = publicFacts({ ...ready, property_type: 'Studio', map_link: 'PRIVATE-MAP' });
  assert.equal(facts.type, 'Apartment');
  assert.equal(facts.bedrooms, 0);
  assert.equal(facts.location, 'Dubai Marina, Dubai');
  assert.equal(facts.size, 1200);
  for (const secret of ['PRIVATE', 'SYNTHETIC-UNIT', 'SYNTHETIC-TOWER'])
    assert.equal(JSON.stringify(facts).includes(secret), false);
  assert.equal(publicFacts({ ...ready, property_type: 'Office' }).bedrooms, '');
});

test('the review shows parking and amenities, and guests and stay for holiday homes only', () => {
  const extras = { parking_spaces: '2', amenities: 'Pool; Gym', maximum_guests: '6' };
  const facts = publicFacts({ ...ready, ...extras, minimum_stay_nights: '3' });
  assert.deepEqual([facts.parking, facts.amenities, facts.guests], ['2', 'Pool, Gym', '']);
  const stay = publicFacts({
    ...ready,
    ...extras,
    sale_rental: 'Holiday',
    minimum_stay_nights: '3',
  });
  assert.deepEqual([stay.guests, stay.minimumStay], ['6', '3']);
});
