import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAtelier, companyDesignSample } from '../src/lib/company-design.ts';
import { sampleCatalogue } from '../src/lib/sample-catalogue.ts';
import { sampleSite } from '../src/lib/host.ts';
import { samplePage, validateCatalogueScope } from '../src/lib/page-model.ts';
import { websiteRoute } from '../src/lib/routing.ts';

const site = sampleSite('harbour.localhost')!;

test('the second website is selected only for company theme one', () => {
  assert.equal(isAtelier(site), true);
  assert.equal(isAtelier(sampleSite('localhost')!), false);
  for (const host of [
    'harbour-modern.localhost',
    'harbour-editorial.localhost',
    'harbour-nocturne.localhost',
  ]) {
    assert.equal(isAtelier(sampleSite(host)!), false);
  }
  assert.equal(sampleSite('unregistered.example'), null);
});

test('architectural preview assets do not change source inventory or ownership', () => {
  const source = sampleCatalogue(site);
  const before = structuredClone(source);
  const adapted = companyDesignSample(source);
  assert.deepEqual(source, before);
  assert.deepEqual(
    adapted.listings.map(({ id, agent, company, price, purpose }) => ({
      id,
      agent,
      company,
      price,
      purpose,
    })),
    source.listings.map(({ id, agent, company, price, purpose }) => ({
      id,
      agent,
      company,
      price,
      purpose,
    })),
  );
  assert.ok(adapted.listings.every((p) => p.image.startsWith('/company/')));
  assert.doesNotThrow(() => validateCatalogueScope(adapted, site));
  assert.equal(samplePage(site, adapted, 'property', {}, '3'), null);
});

test('company team follows five-person pages without changing other company themes', () => {
  const catalogue = companyDesignSample(sampleCatalogue(site));
  const expanded = {
    ...catalogue,
    agents: Array.from({ length: 13 }, (_, i) => ({
      ...catalogue.agents[0],
      id: 'advisor-' + i,
      name: 'Advisor ' + i,
    })),
  };
  const first = samplePage(site, expanded, 'agents', {})!;
  const second = samplePage(site, expanded, 'agents', { page: '2' })!;
  assert.equal(first.catalogue.agents.length, 5);
  assert.equal(second.catalogue.agents[0].id, 'advisor-5');
  assert.equal(second.directory?.total, 13);
  assert.equal(
    samplePage({ ...site, theme: '3' }, expanded, 'agents', {})?.directory?.pageSize,
    12,
  );
});

test('company service route and targeted enquiries retain their public routing contract', () => {
  assert.deepEqual(websiteRoute(['services']), { page: 'services' });
  const catalogue = companyDesignSample(sampleCatalogue(site));
  assert.ok(samplePage(site, catalogue, 'enquiry', { company: site.company! }));
  assert.equal(samplePage(site, catalogue, 'enquiry', { company: 'cedar' }), null);
  assert.equal(samplePage(site, catalogue, 'enquiry', { listing: '1', agent: 'adam' }), null);
});
