import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amenities, furnishings, optionLabel } from '../src/lib/options.ts';
import { developersByListings } from '../src/lib/developer-order.ts';
import { companyDesignSample } from '../src/lib/company-design.ts';
import { sampleCatalogue } from '../src/lib/sample-catalogue.ts';
import { sampleSite } from '../src/lib/host.ts';
import { samplePage } from '../src/lib/page-model.ts';

test('stored listing values become readable public labels', () => {
  assert.equal(optionLabel(furnishings, 'part-furnished'), 'Part-furnished');
  assert.equal(optionLabel(amenities, 'maids-room'), 'Maid’s room');
  assert.equal(optionLabel(amenities, 'gym'), 'Gym');
  assert.equal(optionLabel(amenities, 'private-beach'), 'Private beach');
});

test('developers with listings on the site come first without reordering the rest', () => {
  const developers = [
    { id: 'a', name: 'A', emirate: 'Dubai', publicListingCount: 0 },
    { id: 'b', name: 'B', emirate: 'Dubai', publicListingCount: 2 },
    { id: 'c', name: 'C', emirate: 'Dubai' },
    { id: 'd', name: 'D', emirate: 'Dubai', publicListingCount: 1 },
  ];
  assert.deepEqual(
    developersByListings(developers).map((d) => d.id),
    ['b', 'd', 'a', 'c'],
  );
  const site = sampleSite('harbour-editorial.localhost')!;
  const page = samplePage(site, sampleCatalogue(site), 'developers', {})!;
  const counts = page.catalogue.developers.map((d) => d.publicListingCount || 0);
  assert.ok(counts[0] > 0 && counts[1] > 0);
  assert.equal(page.directory?.total, sampleCatalogue(site).developers.length);
});

test('each design company keeps its own sample listing names and distinct gallery photos', () => {
  const harbour = companyDesignSample(sampleCatalogue(sampleSite('harbour.localhost')!));
  const cedar = companyDesignSample(sampleCatalogue(sampleSite('cedar.localhost')!));
  assert.equal(harbour.listings[0].title, 'Serenity Tower');
  const harbourTitles = new Set(harbour.listings.map((p) => p.title));
  assert.ok(cedar.listings.every((p) => !harbourTitles.has(p.title)));
  for (const listing of [...harbour.listings, ...cedar.listings])
    assert.equal(new Set(listing.photos).size, listing.photos.length);
  assert.ok(harbour.listings.every((p) => !/hero|villa\.jpg/.test(p.image)));
});
