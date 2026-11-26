import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHomeverse, isCompanyDesign, companyDesignSample } from '../src/lib/company-design.ts';
import { sampleSite } from '../src/lib/host.ts';
import { sampleCatalogue } from '../src/lib/sample-catalogue.ts';
import { samplePage, validateCatalogueScope } from '../src/lib/page-model.ts';
const site = sampleSite('harbour-modern.localhost')!;

test('navy and gold website stays isolated to company theme two', () => {
  assert.ok(isHomeverse(site));
  assert.ok(isCompanyDesign(site));
  for (const host of [
    'localhost',
    'harbour.localhost',
    'harbour-editorial.localhost',
    'dune.localhost',
  ])
    assert.equal(isHomeverse(sampleSite(host)!), false);
});

test('hero search retains purpose-specific prices, bedrooms and company ownership', () => {
  const catalogue = companyDesignSample(sampleCatalogue(site));
  const filtered = samplePage(site, catalogue, 'properties', {
    purpose: 'buy',
    area: 'hills',
    type: 'Villa',
    maxPrice: '5000000',
    bedrooms: '2',
  })!;
  assert.deepEqual(
    filtered.results?.items.map((p) => p.id),
    ['2'],
  );
  assert.doesNotThrow(() => validateCatalogueScope(catalogue, site));
  assert.equal(samplePage(site, catalogue, 'property', {}, '3'), null);
  assert.equal(samplePage(site, catalogue, 'enquiry', { listing: '2', agent: 'maya' }), null);
  assert.equal(samplePage(site, catalogue, 'agents', {})?.directory?.pageSize, 5);
});
