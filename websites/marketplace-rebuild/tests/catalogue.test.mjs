import { test } from 'node:test';
import assert from 'node:assert/strict';
import { properties, price } from '../src/data.js';
import { filterProperties, compareSelection, ids, write, remember } from '../src/state.js';

test('rental studio filters do not include commercial offices', () => {
  const params = new URLSearchParams({ purpose: 'Rent', beds: '0' });
  assert.deepEqual(filterProperties(properties, params).map(p => p.id), [4]);
});

test('price ranges apply only to one price period', () => {
  const params = new URLSearchParams({ min: '1000000' });
  assert.equal(filterProperties(properties, params).length, properties.length);
  params.set('purpose', 'Rent');
  assert.equal(filterProperties(properties, params).length, 0);
});

test('sale prices sort numerically', () => {
  const params = new URLSearchParams({ purpose: 'Buy', sort: 'price-asc' });
  assert.deepEqual(filterProperties(properties, params).map(p => p.id), [5, 3, 6, 1]);
});

test('comparison rejects mixed sale and annual rental periods', () => {
  write('compare', []);
  assert.equal(compareSelection(1, properties), '');
  assert.match(compareSelection(2, properties), /separately/);
  assert.deepEqual(ids('compare'), [1]);
  assert.equal(compareSelection(5, properties), '');
});

test('comparison permits at most three and supports removal', () => {
  write('compare', [1, 3, 5]);
  assert.match(compareSelection(6, properties), /three/);
  compareSelection(3, properties);
  assert.deepEqual(ids('compare'), [1, 5]);
});

test('recent listings are unique and ordered by last visit', () => {
  write('recent', []);
  remember(1);
  remember(2);
  remember(1);
  assert.deepEqual(ids('recent'), [1, 2]);
});

test('rental prices explicitly show annual period', () => {
  assert.match(price(properties[1]), /year/);
  assert.doesNotMatch(price(properties[0]), /year/);
});
