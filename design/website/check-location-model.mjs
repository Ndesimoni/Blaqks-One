import test from 'node:test';
import assert from 'node:assert/strict';
import { communityMap, propertyLocation } from './property-location.js';
import { areaBy, propertyBy } from './data.js';

test('public map is a community extent without a listing marker', () => {
  for (const area of ['marina', 'hills', 'saadiyat']) {
    const map = communityMap(area);
    const embed = new URL(map.embed);
    assert.equal(embed.origin, 'https://www.openstreetmap.org');
    assert.deepEqual([...embed.searchParams.keys()].sort(), ['bbox', 'layer']);
    assert.equal(embed.searchParams.get('bbox').split(',').length, 4);
    assert.ok(!map.external.includes('mlat'));
  }
  for (const id of ['unknown', '__proto__', 'toString', null]) {
    assert.equal(communityMap(id), null);
  }
});

test('private property fields cannot change or leak through public location HTML', () => {
  const property = propertyBy('1');
  const area = areaBy(property.area);
  const original = propertyLocation(property, area, { site: 'harbour', theme: '4' });
  const privateFields = {
    ...property,
    latitude: 12.345678,
    longitude: 98.765432,
    exactAddress: 'PRIVATE-UNIT-1042',
    mapLink: 'https://private.example/secret',
    accessInstructions: 'SECRET-ACCESS',
  };
  assert.equal(propertyLocation(privateFields, area, { site: 'harbour', theme: '4' }), original);
  assert.match(original, /listing=1/);
  assert.match(original, /site=harbour/);
  assert.match(original, /theme=4/);
});

test('unknown community retains enquiry without inventing a map', () => {
  const html = propertyLocation(
    propertyBy('1'),
    { id: 'unknown', name: 'New area', city: 'Dubai' },
    {},
  );
  assert.match(html, /community map is not available/);
  assert.match(html, /Ask agent for exact location/);
  assert.ok(!html.includes('data-map-src'));
});
