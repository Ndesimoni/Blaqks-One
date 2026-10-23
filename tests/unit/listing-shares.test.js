import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogs } from '../../src/i18n/catalogs/index.js';
import { createTranslator } from '../../src/i18n/translate.js';
import {
  readListingShare,
  readListingShareList,
  readPreview,
} from '../../src/features/server/listingShares/listingShareModel.js';
import {
  dubaiDay,
  listingShareLink,
  listingShareLinkId,
  listingShareRoute,
  listingWhatsAppText,
  toProperty,
} from '../../src/features/server/listingShares/listingShareLinks.js';

// Record sharing R2a (docs/record-sharing.md, R2 API contract): listing shares between companies.
const ID = '6f1c2a34-8b9d-4e0f-a123-456789abcdef';
const FROM = '11111111-2222-4333-8444-555555555555';
const TO = '99999999-8888-4777-8666-555555555555';
const allowed = { accept: true, decline: true, withdraw: false, stop: false, extend: false };
const view = (extra = {}) => ({
  ...{ id: ID, reference: 'LS-AB12CD34', label: 'Marina view · Dubai Marina', side: 'recipient' },
  ...{ viewer: 'agent', status: 'pending', endReason: null, note: null },
  from: { id: FROM, name: 'Synthetic Layla', company: 'Synthetic Homes', phone: null, email: null },
  to: { id: TO, name: 'Synthetic Omar', company: null },
  ...{ createdAt: '2026-10-23T08:00:00.000Z', offerEndsAt: '2026-11-06T08:00:00.000Z' },
  ...{ viewEndsAt: '2026-11-22T19:59:59.000Z', decidedAt: null, openedAt: null, closedAt: null },
  ...{ declinedAsKnown: false, exactLocation: false, recordId: null },
  listing: { listingTitle: 'Marina view', community: 'Dubai Marina', ownerPhone: '0501234567' },
  ...{ photos: [], floorPlans: [], allowed: { ...allowed, evidence: true } },
  ...extra,
});

test('a share view keeps only the known listing facts and refuses unknown shapes', () => {
  const share = readListingShare(view());
  assert.equal(share.reference, 'LS-AB12CD34');
  assert.deepEqual(share.listing, { listingTitle: 'Marina view', community: 'Dubai Marina' });
  assert.ok(Object.isFrozen(share) && Object.isFrozen(share.allowed));
  assert.equal(share.to.phone, undefined, 'only the sender carries contact fields');
  assert.equal(readListingShare(view({ listing: null })).listing, null);
  for (const bad of [
    { reference: 'LS-1' },
    { status: 'sent' },
    { viewer: 'admin' },
    { id: 'not-a-uuid' },
    { allowed: { accept: true } },
    { photos: [{ name: 'x', file: 'nope' }] },
  ])
    assert.throws(() => readListingShare(view(bad)), /invalid listing share/);
  assert.equal(readListingShareList({ shares: [view()] }).length, 1);
  assert.throws(() => readListingShareList({ incoming: [] }));
});

test('the preview keeps known warnings and requires its digest', () => {
  const preview = readPreview({
    before: { listingTitle: 'Marina view' },
    after: { listingTitle: 'Marina view', description: 'Sea views' },
    files: { photos: ['Photo 1'], floorPlans: [] },
    exactLocation: false,
    warnings: ['contact', 'made-up'],
    previewDigest: 'a'.repeat(64),
  });
  assert.deepEqual(preview.warnings, ['contact']);
  assert.deepEqual(preview.photos, ['Photo 1']);
  assert.throws(() => readPreview({ files: {}, warnings: [], previewDigest: 'x' }));
});

test('links carry only the share ID, and only the exact shape opens', () => {
  const link = listingShareLink('https://crm.example.test', ID);
  assert.equal(link, `https://crm.example.test/#/listing-shares/${ID}`);
  assert.equal(listingShareLinkId(`/listing-shares/${ID}`), ID);
  assert.equal(listingShareRoute(`/listing-shares/${ID}`), 'Shared listing');
  for (const path of [`/listing-shares/${ID}/x`, `/shares/${ID}`, '/listing-shares/abc', ''])
    assert.equal(listingShareLinkId(path), null, path);
  assert.throws(() => listingShareLink('https://crm.example.test', 'abc'));
});

test('the WhatsApp text names the sender and the link only', () => {
  const t = createTranslator('en', catalogs, {});
  const link = listingShareLink('https://crm.example.test', ID);
  const text = listingWhatsAppText(t, 'Synthetic Layla', link);
  assert.equal(text, `Synthetic Layla shared a property with you in Blaqks One: ${link}`);
  for (const word of ['Marina', 'AED', 'Dubai']) assert.ok(!text.includes(word), word);
});

test('dates count Dubai days and the listing view gets every fact', () => {
  const late = Date.parse('2026-10-23T21:30:00.000Z');
  assert.equal(dubaiDay(0, late), '2026-10-24', 'already 24 October in Dubai');
  assert.equal(dubaiDay(30, late), '2026-11-23');
  const property = toProperty({ listingTitle: 'Marina view' });
  assert.equal(property.listingTitle, 'Marina view');
  assert.equal(property.bedrooms, null);
  assert.deepEqual([property.photos, property.floorPlans], [[], []]);
});
