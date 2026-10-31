import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeCatalogue,
  decodeListing,
  decodeSite,
  publicImage,
} from '../src/lib/public-shapes.ts';
import { sampleCatalogue } from '../src/lib/sample-catalogue.ts';
import { sampleSite } from '../src/lib/host.ts';
import { readPublicBody } from '../src/lib/public-response.ts';

test('unknown private API fields never enter the website catalogue or client props', () => {
  const source = sampleCatalogue(sampleSite('localhost')!);
  const dirty = {
    ...source,
    listings: source.listings.map((p) => ({
      ...p,
      exactAddress: 'PRIVATE-UNIT',
      latitude: 25.123456,
      landlord: 'PRIVATE-LANDLORD',
      accessToken: 'PRIVATE-TOKEN',
    })),
    agents: source.agents.map((a) => ({
      ...a,
      loginEmail: 'PRIVATE-LOGIN',
      password: 'PRIVATE-PASSWORD',
    })),
  };
  const publicData = JSON.stringify(decodeCatalogue(dirty));
  assert.ok(!publicData.includes('PRIVATE-'));
  assert.ok(!publicData.includes('latitude'));
});

test('invalid types, executable URLs and unsupported gallery sizes are rejected', () => {
  const listing = sampleCatalogue(sampleSite('localhost')!).listings[0];
  for (const data of [
    { ...listing, price: '2450000' },
    { ...listing, price: NaN },
    { ...listing, photos: Array(21).fill(listing.image) },
    { ...listing, floorPlans: Array(4).fill(listing.image) },
  ])
    assert.throws(() => decodeListing(data));
  for (const url of [
    'javascript:alert(1)',
    'data:text/html;base64,AAA',
    '//evil.example/image',
    'http://evil.example/image',
  ])
    assert.throws(() => publicImage(url));
  assert.equal(publicImage('https://cdn.example/image.webp'), 'https://cdn.example/image.webp');
});

test('live site decoding never accepts sample flags or inconsistent company identity', () => {
  assert.equal(
    decodeSite({ id: 'x', name: 'X', kind: 'platform', company: null, theme: '1', sample: true })
      .sample,
    false,
  );
  assert.throws(() =>
    decodeSite({ id: 'x', name: 'X', kind: 'company', company: null, theme: '1' }),
  );
});

test('streamed API bodies are byte-bounded even without a Content-Length header', async () => {
  const small = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('hello'));
        controller.close();
      },
    }),
  );
  assert.equal(await readPublicBody(small, 5), 'hello');
  const large = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(6));
        controller.close();
      },
    }),
  );
  await assert.rejects(readPublicBody(large, 5), /Oversized/);
});
