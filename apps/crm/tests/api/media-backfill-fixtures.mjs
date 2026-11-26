/**
 * Synthetic property records with inline media for the media-backfill suite, in two fresh
 * companies so shared fixtures stay untouched.
 */
import assert from 'node:assert/strict';
import { jpegWithGps, pdf } from './media-helpers.mjs';
import { sampleAdmin } from './sample-helpers.mjs';
import { dataUrl, giveOversizedPhoto } from './media-backfill-helpers.mjs';

export const { admin, workspace } = await sampleAdmin('media-backfill-admin');
export const recordsPath = `/workspaces/${workspace}/records/Properties`;
const elsewhere = await sampleAdmin('media-backfill-other');
export const otherWorkspace = elsewhere.workspace;

async function property(session, path, record) {
  const created = await session.request(path, { method: 'POST', body: { record } });
  assert.equal(created.status, 201, JSON.stringify(created.value));
  return created.value;
}

export const front = {
  name: 'Synthetic front',
  type: 'image/jpeg',
  added: '2026-01-02',
  src: dataUrl('image/jpeg', jpegWithGps()),
};
export const demo = {
  name: 'Demo villa exterior.jpg',
  type: 'image/jpeg',
  src: dataUrl('image/jpeg', jpegWithGps()),
  demo: true,
  source: 'generated-demo',
};
export const animation = {
  name: 'Animation',
  src: dataUrl('image/jpeg', Buffer.from('GIF89a synthetic')),
};
const plan = {
  name: 'Synthetic plan',
  type: 'application/pdf',
  src: dataUrl('application/pdf', pdf()),
};

export const villa = await property(admin, recordsPath, {
  listing_title: 'Synthetic inline villa',
  media_photos: [front, demo, animation],
  media_floorplans: [plan],
});
export const huge = await property(admin, recordsPath, {
  listing_title: 'Synthetic oversized listing',
  media_photos: [],
});
giveOversizedPhoto(huge.id);
export const other = await property(
  elsewhere.admin,
  `/workspaces/${otherWorkspace}/records/Properties`,
  {
    listing_title: 'Synthetic other-company listing',
    media_photos: [{ name: 'Elsewhere', src: dataUrl('image/jpeg', jpegWithGps()) }],
  },
);
export const ids = [villa.id, huge.id, other.id];
export const expectedLeft = [
  { record: villa.id, field: 'media_photos', index: 1, reason: 'other_fields' },
  { record: villa.id, field: 'media_photos', index: 2, reason: 'unsupported' },
  { record: huge.id, field: 'media_photos', index: 0, reason: 'too_large' },
];
