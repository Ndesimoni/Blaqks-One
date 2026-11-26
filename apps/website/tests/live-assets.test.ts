import test from 'node:test';
import assert from 'node:assert/strict';
import { publicImage, decodeSite } from '../src/lib/public-shapes.ts';
import { isPublicMedia, bindPublicAssets } from '../src/lib/public-assets.ts';
import { sampleCatalogue } from '../src/lib/sample-catalogue.ts';
import { sampleSite } from '../src/lib/host.ts';
import { communityView } from '../src/lib/community-map.ts';

test('site-bound public media queries are accepted and only these paths rebase to the API origin', () => {
  const value =
    '/api/public/v1/sites/11111111-1111-4111-8111-111111111111/media/22222222-2222-4222-8222-222222222222?host=company.example';
  assert.equal(publicImage(value), value);
  assert.ok(isPublicMedia(value));
  for (const privateUrl of [
    '/api/crm/media/private',
    'https://api.example/api/crm/media/private',
    '/assets/../api/crm/media/private',
    'https://user:secret@images.example/photo.jpg',
  ])
    assert.throws(() => publicImage(privateUrl));
  for (const bad of [
    value + '&secret=1',
    value.replace('/api/public/', '/api/crm/'),
    value.replace('company.example', 'evil@company.example'),
    value + '#private',
  ])
    assert.ok(!isPublicMedia(bad));
  const site = sampleSite('localhost')!,
    catalogue = sampleCatalogue(site);
  catalogue.listings[0].image = value;
  const result = bindPublicAssets(
    { site, catalogue, page: 'home', query: {} },
    'https://api.example',
  );
  assert.equal(result.catalogue.listings[0].image, 'https://api.example' + value);
  assert.equal(result.catalogue.listings[1].image, catalogue.listings[1].image);
});

test('known community maps support backend IDs but reject the same name in a different emirate', () => {
  const area = sampleCatalogue(sampleSite('localhost')!).areas[0];
  assert.ok(communityView({ ...area, id: 'area-hashed-by-server' }));
  assert.equal(communityView({ ...area, emirate: 'abu-dhabi' }), undefined);
  assert.equal(communityView({ ...area, id: 'unknown', name: 'Unmapped community' }), undefined);
});

test('CMS site decoding accepts selected public copy while discarding private keys', () => {
  const site = decodeSite({
    id: 'x',
    kind: 'company',
    company: 'y',
    theme: '1',
    name: 'Company',
    content: { heroTitle: 'Published hero', privateNotes: 'SECRET', script: '<script>' },
  });
  assert.deepEqual(site.content, { heroTitle: 'Published hero' });
});
