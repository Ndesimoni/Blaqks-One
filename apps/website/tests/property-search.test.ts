import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleSite } from '../src/lib/host.ts';
import { sampleCatalogue } from '../src/lib/sample-catalogue.ts';
import { searchProperties } from '../src/lib/property-search.ts';
import { samplePage } from '../src/lib/page-model.ts';

const site = sampleSite('localhost')!,
  catalogue = sampleCatalogue(site);

test('purpose-bound inclusive budget finds the exact Studio and all emirates remain filterable', () => {
  const p = catalogue.listings[0];
  const result = searchProperties(catalogue, {
    purpose: 'buy',
    emirate: 'dubai',
    minPrice: String(p.price),
    maxPrice: String(p.price),
    bedrooms: 'studio',
  });
  assert.deepEqual(
    result.items.map((v) => v.id),
    [p.id],
  );
  assert.equal(searchProperties(catalogue, { emirate: 'fujairah' }).total, 0);
});

test('invalid and cross-purpose budgets never widen results', () => {
  for (const query of [
    { minPrice: '1' },
    { purpose: 'buy', minPrice: '9', maxPrice: '1' },
    { purpose: 'buy', maxPrice: 'Infinity' },
    { purpose: 'buy', minPrice: '-1' },
    { purpose: 'rent', guests: '4' },
    { sort: 'price-asc' },
    { emirate: 'dubai', area: 'saadiyat' },
  ]) {
    const result = searchProperties(catalogue, query);
    assert.equal(result.total, 0);
    assert.ok(result.errors.length);
  }
});

test('multiple amenities match all; holiday and commercial facts remain distinct', () => {
  const result = searchProperties(catalogue, { purpose: 'buy', amenities: ['pool', 'garden'] });
  assert.equal(result.total, 2);
  assert.ok(
    result.items.every((p) => p.amenities.includes('pool') && p.amenities.includes('garden')),
  );
  assert.equal(searchProperties(catalogue, { type: 'Office', bedrooms: 'studio' }).total, 0);
  assert.ok(
    searchProperties(catalogue, { purpose: 'holiday', guests: '4', nights: '2' }).items.every(
      (p) => p.guests >= 4 && p.minimumStay <= 2,
    ),
  );
});

test('pagination clamps invalid pages, sorting uses publication date and directories preserve totals', () => {
  const first = searchProperties(catalogue, {});
  assert.equal(first.items.length, 12);
  assert.equal(first.total, 18);
  assert.equal(searchProperties(catalogue, { page: '999' }).page, 2);
  assert.equal(searchProperties(catalogue, { page: '1.5' }).page, 1);
  assert.equal(first.items[0].publishedAt, catalogue.listings[0].publishedAt);
  const directory = samplePage(site, catalogue, 'developers', { page: '2' })!;
  assert.equal(directory.directory?.total, 40);
  assert.equal(directory.catalogue.developers.length, 12);
});
