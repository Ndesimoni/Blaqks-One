import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sampleSite } from '../src/lib/host.ts';
import { samplePage } from '../src/lib/page-model.ts';
import { referenceSampleCatalogue } from '../src/lib/reference/sample.ts';
// @ts-expect-error The build-time patch module is plain JavaScript without declarations.
import { patchReference } from '../scripts/reference-patches.mjs';

const site = sampleSite('localhost')!;
const catalogue = referenceSampleCatalogue();
const styles = readFileSync(new URL('../public/approved/reference.css', import.meta.url), 'utf8');

test('the sample developer directory has 40 reference names, 12 per page', () => {
  assert.equal(catalogue.developers.length, 40);
  const page = samplePage(site, catalogue, 'developers', {})!;
  assert.equal(page.directory?.total, 40);
  assert.equal(page.catalogue.developers.length, 12);
  const search = samplePage(site, catalogue, 'developers', { q: 'dub' })!;
  assert.deepEqual(
    search.catalogue.developers.map((d) => d.id),
    ['dubai-properties', 'expo-city', 'dubai-south'],
  );
});

test('sample listings carry distinct, explicitly illustrative developer associations', () => {
  const associations = catalogue.listings.map((listing) => listing.developer);
  assert.equal(new Set(associations).size, catalogue.listings.length);
  assert.ok(catalogue.listings.every((listing) => listing.developerIllustrative));
  for (const id of associations)
    assert.ok(
      catalogue.developers.some((d) => d.id === id),
      id,
    );
});

test('community profiles resolve only their own published listings', () => {
  const downtown = catalogue.areas.find((area) => area.name === 'Downtown Dubai')!;
  const page = samplePage(site, catalogue, 'area', {}, downtown.id)!;
  const own = page.catalogue.listings.filter((listing) => listing.area === downtown.id);
  assert.deepEqual(
    own.map((listing) => listing.title),
    ['Skyline residence', 'A residence above the city'],
  );
});

test('body-level approved selectors keep their focus ring and modal styles', () => {
  assert.match(
    styles,
    /body\[data-site-kind=platform\]\.estate-page :focus-visible\{outline:3px solid #d0a75a/,
  );
  assert.match(styles, /body\[data-site-kind=platform\]\.estate-page \.modal\{/);
  assert.doesNotMatch(styles, /body\[data-site-kind=platform\] \.estate-page/);
});

test('gold actions use navy text and the navy band copy is light', () => {
  assert.match(styles, /:is\(\.e-gold,\.b-professional-menu>summary\)\{color:#06233d!important\}/);
  assert.match(styles, /:is\(\.e-why,\.u-company-hero\)\{--read-copy: ?#d2dce5/);
});

test('the renderer re-queries its mount points and the footer links every directory', async () => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'blaqks-patch-'));
  try {
    const archive = new URL('../reference/approved-source.tar.gz', import.meta.url).pathname;
    execFileSync('tar', ['-xzf', archive, '-C', temporary]);
    await patchReference(temporary + '/dist');
    const app = readFileSync(temporary + '/dist/app.js', 'utf8');
    assert.match(app, /let app = document\.querySelector\("#app"\)/);
    assert.match(
      app,
      /export function render\(\) \{\n {2}app = document\.querySelector\("#app"\);/,
    );
    const footer = readFileSync(temporary + '/dist/property-extras.js', 'utf8');
    for (const href of ['/areas', '/developers', '/privacy', '/terms'])
      assert.ok(footer.includes(`href="${href}"`), href);
    const journey = readFileSync(temporary + '/dist/property-journey.js', 'utf8');
    assert.match(journey, /r===route\?' aria-current="page"'/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
