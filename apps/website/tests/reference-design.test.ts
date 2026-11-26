import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { referenceSampleCatalogue } from '../src/lib/reference/sample.ts';
import { referenceJSON } from '../src/lib/reference/serialize.ts';
import { referenceIdentity } from '../src/lib/reference/identity.ts';
import { publicDestination, referenceRoute } from '../src/lib/reference/navigation.ts';
import type { PageData } from '../src/lib/types.ts';
import pages from '../src/generated/approved-pages.json' with { type: 'json' };

const data: PageData = {
  site: {
    id: 'platform',
    kind: 'platform',
    name: 'Blaqks One',
    company: null,
    theme: '1',
    sample: true,
  },
  catalogue: referenceSampleCatalogue(),
  page: 'home',
  query: {},
};

test('the approved six-property catalogue and original professional profiles are retained', () => {
  assert.equal(data.catalogue.listings.length, 6);
  assert.equal(data.catalogue.listings[0].title, 'Contemporary waterfront villa');
  assert.equal(data.catalogue.agents[0].name, 'Alex Morgan');
  assert.equal(data.catalogue.companies[0].name, 'Coastal & Co.');
});

test('all original photographs remain byte-for-byte identical', () => {
  const archive = new URL('../reference/approved-source.tar.gz', import.meta.url);
  for (const image of ['villa', 'living', 'bedroom', 'apartment', 'office']) {
    const original = execFileSync('tar', ['-xOzf', archive.pathname, `dist/assets/${image}.jpg`]);
    const prepared = readFileSync(
      new URL(`../public/approved/assets/${image}.jpg`, import.meta.url),
    );
    const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
    assert.equal(hash(prepared), hash(original), image);
  }
});

test('approved page snapshots include the complete website and account flow', () => {
  for (const route of [
    'home',
    'properties',
    'property/1',
    'agents',
    'agent/0',
    'companies',
    'company/0',
    'deals',
    'distress-deals',
    'discount-deals',
    'saved',
    'recent',
    'compare',
    'about',
    'contact',
    'help',
    'professionals',
    'signup',
    'signin',
    'verify',
    'company',
    'invite',
    'ready',
  ]) {
    assert.ok((pages as Record<string, string>)[route], route);
  }
  assert.equal((pages.home.match(/class="d-card"/g) || []).length, 3);
  assert.match(pages.home, /u-compact-featured/);
});

test('reference routes resolve to real Next paths and reject unknown records', () => {
  assert.equal(publicDestination('#property/1', data), '/properties/1');
  assert.equal(publicDestination('#agent/0', data), '/agents/0');
  assert.equal(publicDestination('#company', data), '/company-setup');
  assert.equal(publicDestination('#property/999999', data), null);
  assert.equal(publicDestination('#javascript:alert(1)', data), null);
  assert.equal(referenceRoute({ ...data, page: 'company-setup' }), 'company');
});

test('live public record aliases are stable, positive and site scoped', () => {
  const first = referenceIdentity('one:property', 'public-uuid', false);
  assert.equal(referenceIdentity('one:property', 'public-uuid', false), first);
  assert.notEqual(referenceIdentity('two:property', 'public-uuid', false), first);
  assert.ok(first > 0);
});

test('embedded public data cannot close its JSON script element', () => {
  const source = { text: '</script><script>alert(1)</script>' };
  const serialized = referenceJSON(source);
  assert.ok(!serialized.includes('<'));
  assert.deepEqual(JSON.parse(serialized), source);
});
