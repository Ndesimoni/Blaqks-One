import test from 'node:test';
import assert from 'node:assert/strict';
import { attachDemoListingPhotos, demoListingPhoto } from '../../src/lib/demoPropertyPhotos.js';

test('demo photos match residential and commercial property categories', () => {
  assert.match(demoListingPhoto({ property_type: 'Apartment' }).name, /apartment/);
  assert.match(demoListingPhoto({ property_type: 'Villa' }).name, /villa/);
  assert.match(demoListingPhoto({ property_type: 'Townhouse' }).name, /villa/);
  assert.match(demoListingPhoto({ property_type: 'Office' }).name, /office/);
});

test('adding import samples preserves existing photos, linked fields and untouched source records', async () => {
  const actual = { name: 'Actual.jpg', src: 'data:image/jpeg;base64,YQ==' };
  const source = {
    Clients: [{ client_id: 'CL-PHOTO' }],
    Contacts: [{ contact_id: 'CT-PHOTO' }],
    Properties: [
      { property_id: 'PR-ACTUAL', media_photos: [actual] },
      { property_id: 'PR-DEMO', property_type: 'Villa', contact_id: 'CT-PHOTO' },
    ],
  };
  const original = JSON.stringify(source);
  const requested = [];
  const result = await attachDemoListingPhotos(source, async (sample) => {
    requested.push(sample);
    return { name: sample.name, src: 'data:image/jpeg;base64,Yg==', demo: true };
  });
  assert.equal(JSON.stringify(source), original);
  assert.equal(result.Clients, source.Clients);
  assert.equal(result.Contacts, source.Contacts);
  assert.equal(result.Properties[0], source.Properties[0]);
  assert.equal(result.Properties[1].contact_id, 'CT-PHOTO');
  assert.equal(result.Properties[1].media_photos[0].demo, true);
  assert.equal(requested.length, 1);
  assert.match(requested[0].name, /villa/);
});

test('sample failures reject the complete preparation without mutating browser records', async () => {
  const source = { Clients: [], Contacts: [], Properties: [{ property_id: 'PR-FAIL' }] };
  await assert.rejects(
    attachDemoListingPhotos(source, async () => {
      throw Error('Photo unavailable');
    }),
    /Photo unavailable/,
  );
  assert.equal(source.Properties[0].media_photos, undefined);
});
