import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHost, sampleSite } from '../src/lib/host.ts';
import { sampleCatalogue } from '../src/lib/sample-catalogue.ts';
import { samplePage, validateCatalogueScope } from '../src/lib/page-model.ts';
import { websiteRoute } from '../src/lib/routing.ts';

test('only explicit local preview hosts resolve and forged hosts fail closed', () => {
  assert.equal(normalizeHost('HARBOUR.localhost:3000'), 'harbour.localhost');
  for (const host of [
    'x@harbour.localhost',
    'harbour.localhost/secret',
    'localhost,evil',
    'localhost:99999',
    'a..com',
    '',
  ])
    assert.equal(normalizeHost(host), null);
  for (const host of ['evil.example', 'missing.localhost', '__proto__', 'toString'])
    assert.equal(sampleSite(host), null);
  assert.equal(sampleSite('harbour-nocturne.localhost')?.theme, '4');
});

test('company catalogues and every profile/detail respect the host scope', () => {
  const site = sampleSite('harbour.localhost')!;
  const catalogue = sampleCatalogue(site);
  validateCatalogueScope(catalogue, site);
  assert.equal(catalogue.listings.length, 6);
  assert.ok(catalogue.listings.every((p) => p.company === 'harbour'));
  assert.equal(samplePage(site, catalogue, 'property', {}, '3'), null);
  assert.equal(samplePage(site, catalogue, 'agent', {}, 'leila'), null);
  assert.equal(samplePage(site, catalogue, 'company', {}, 'cedar'), null);
  assert.throws(
    () => validateCatalogueScope(sampleCatalogue(sampleSite('localhost')!), site),
    /scope mismatch/,
  );
});

test('enquiry references cannot change listing or company ownership', () => {
  const site = sampleSite('localhost')!,
    catalogue = sampleCatalogue(site);
  for (const query of [
    { listing: '1', agent: 'leila' },
    { listing: '1', company: 'cedar' },
    { agent: 'maya', company: 'cedar' },
    { listing: 'unknown' },
  ])
    assert.equal(samplePage(site, catalogue, 'enquiry', query), null);
  assert.equal(samplePage(site, catalogue, 'enquiry', { listing: '1' })?.entity?.id, '1');
});

test('real route vocabulary excludes legacy editor/review and path injection', () => {
  assert.deepEqual(websiteRoute(['properties', '1']), { page: 'property', id: '1' });
  for (const path of [
    ['editor'],
    ['platform'],
    ['properties', '../private'],
    ['properties', '1', 'files'],
  ])
    assert.equal(websiteRoute(path), null);
});
