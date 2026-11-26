import test from 'node:test';
import assert from 'node:assert/strict';
import { filtered, sortedProperties } from './property-filter-model.js';
import { filterErrors } from './property-filter-validation.js';
import { enquiryRecipient } from './enquiry-recipient.js';
import { properties } from './data.js';
import { emirates, bedroomLabel } from './property-options.js';

const ctx = (query = '', site = '') => ({
  query: new URLSearchParams(query),
  scope: site ? { site } : {},
});
const find = (query, site) => filtered(ctx(query, site));
const ids = (items) => items.map((p) => p.id);

test('all seven emirates are selectable and empty stock never broadens', () => {
  assert.equal(emirates.length, 7);
  assert.equal(find('emirate=dubai').length, 12);
  assert.equal(find('emirate=abu-dhabi').length, 6);
  assert.equal(find('emirate=fujairah').length, 0);
  assert.equal(find('emirate=abu-dhabi', 'harbour').length, 0);
  assert.equal(find('emirate=abu-dhabi&area=marina').length, 0);
  assert.match(filterErrors(ctx('emirate=abu-dhabi&area=marina').query)[0].message, /community/);
});
test('inclusive budget bounds and the legacy maximum use one purpose', () => {
  assert.deepEqual(ids(find('purpose=buy&minPrice=2450000&maxPrice=2630000')), ['1', '2']);
  assert.deepEqual(ids(find('purpose=rent&minPrice=155000&maxPrice=160000')), ['8', '9']);
  assert.equal(find('purpose=buy&budget=3000000').length, 4);
  assert.equal(find('purpose=buy&maxPrice=0').length, 0);
  assert.equal(find('minPrice=0').length, 0);
  assert.equal(find('sort=price-asc').length, 0);
});
test('invalid numbers, enums and reversed ranges produce errors', () => {
  for (const query of [
    'purpose=buy&minPrice=10&maxPrice=1',
    'purpose=buy&minPrice=-1',
    'purpose=buy&maxPrice=Infinity',
    'purpose=buy&maxPrice=NaN',
    'purpose=buy&maxPrice=1e300',
    'minSize=100&maxSize=20',
    'emirate=unknown',
    'bedrooms=99',
    'amenities=not-real',
  ]) {
    assert.ok(filterErrors(ctx(query).query).length, query);
    assert.equal(find(query).length, 0, query);
  }
});
test('size, rooms, furnishing, parking and multiple amenities use actual sample facts', () => {
  assert.deepEqual(ids(find('minSize=1100&maxSize=1230')), ['1', '2']);
  assert.deepEqual(ids(find('bedrooms=studio')), ['1', '7', '13']);
  assert.equal(bedroomLabel(properties[0]), 'Studio');
  assert.equal(bedroomLabel(properties[5]), 'Office');
  assert.deepEqual(ids(find('amenities=pool,garden', 'harbour')), ['2', '8', '14']);
  assert.ok(find('bathrooms=2&parking=1').every((p) => p.bathrooms >= 2 && p.parking >= 1));
  assert.ok(find('furnishing=furnished').every((p) => p.furnishing === 'furnished'));
});
test('holiday capacity and minimum stay never pretend to be booking availability', () => {
  assert.deepEqual(ids(find('purpose=holiday&guests=4&nights=2')), ['14', '16']);
  assert.ok(
    find('purpose=holiday').every((p) => p.ready === 'ready' && p.category === 'residential'),
  );
  assert.equal(find('purpose=rent&ready=off-plan').length, 0);
  assert.equal(find('guests=4').length, 0);
  assert.equal(find('purpose=rent&market=primary').length, 0);
});
test('sorting uses explicit dates, prices and sizes', () => {
  assert.equal(filterErrors(ctx('sort=default').query).length, 0);
  assert.equal(sortedProperties([...properties].reverse(), ctx('sort=default').query)[0].id, '1');
  assert.equal(sortedProperties(find('purpose=buy'), ctx('sort=price-desc').query)[0].id, '6');
  assert.equal(sortedProperties(find('purpose=buy'), ctx('sort=price-asc').query)[0].id, '1');
  assert.equal(sortedProperties(properties, ctx('sort=size-desc').query)[0].id, '18');
  assert.equal(sortedProperties([...properties].reverse(), ctx().query)[0].id, '1');
});
test('enquiries reject unknown or inconsistent IDs and resolve agent ownership', () => {
  for (const query of [
    'listing=missing',
    'company=missing',
    'agent=missing',
    'listing=1&agent=adam',
    'listing=1&company=cedar',
    'company=harbour&agent=leila',
    'platform=1&agent=maya',
  ])
    assert.equal(enquiryRecipient(ctx(query)), null, query);
  assert.equal(enquiryRecipient(ctx('agent=leila', 'harbour')), null);
  assert.equal(enquiryRecipient(ctx('agent=maya')).c.id, 'harbour');
  assert.match(enquiryRecipient(ctx('agent=maya')).recipient, /Maya Reed/);
  assert.ok(enquiryRecipient(ctx('listing=1&company=harbour&agent=maya', 'harbour')));
});
