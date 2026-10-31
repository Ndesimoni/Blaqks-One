import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { patch } from './assignment-helpers.mjs';
import { query } from './helpers.mjs';
import { jpegWithGps, pdf, upload } from './media-helpers.mjs';
import {
  LOCATION,
  PRIVATE,
  accepted,
  act,
  fileStatus,
  listing,
  listingRequest,
  outsideTeams,
  preview,
  read,
  send,
  sendBody,
} from './outside-sharing-helpers.mjs';

// R2a contract (docs/record-sharing.md R2): what crosses to the other company, and when.
let teams;
before(async () => {
  teams = await outsideTeams('outside-contract');
});

const absent = (value, markers, label) => {
  const text = JSON.stringify(value);
  for (const marker of markers) assert.ok(!text.includes(marker), `${label}: ${marker}`);
};
const stored = async (name, bytes = jpegWithGps()) =>
  (await upload(teams.admin, bytes, name)).value.media.id;

test('the agent sees twelve facts until accepting, then the listing and its photo copies', async () => {
  const [photo, plan] = [await stored('owner-front.jpg'), await stored('owner-plan.pdf', pdf())];
  const record = await listing(teams, 'one', {
    media_photos: [{ name: 'owner-front.jpg', type: 'image/jpeg', file: photo }],
    media_floorplans: [{ name: 'owner-plan.pdf', type: 'application/pdf', file: plan }],
  });
  const review = await preview(teams.one, record);
  // PDFs keep document properties the sender never sees, so they stay behind (review M3).
  assert.deepEqual(review.files, { photos: ['Photo 1'], floorPlans: [] });
  assert.ok(review.warnings.includes('pdf'), JSON.stringify(review.warnings));
  assert.equal(review.before.description, undefined);
  assert.equal(review.after.description, 'Bright villa');
  absent(review, [...PRIVATE, ...LOCATION], 'preview');
  const share = await send(teams.one, record, teams.agent, { note: 'Synthetic introduction' });
  assert.match(share.reference, /^LS-[A-Z0-9]{8}$/);
  const pending = await read(teams.agent, share);
  assert.equal(pending.status, 'pending');
  assert.deepEqual([pending.photos, pending.floorPlans], [[], []]);
  assert.equal(pending.listing.listingTitle, record.record.listing_title);
  assert.equal(pending.listing.description, undefined);
  assert.equal(pending.from.phone, null);
  assert.equal(pending.recordId, null);
  absent(pending, [...PRIVATE, ...LOCATION, record.id, 'owner-front'], 'pending');
  const sent = await read(teams.one, share);
  assert.equal(await fileStatus(teams.agent, share, sent.photos[0].file), 404, 'not before');
  const result = await act(teams.agent, share, 'accept');
  assert.equal(result.status, 200, JSON.stringify(result.value));
  const open = result.value.share;
  assert.equal(open.listing.description, 'Bright villa');
  assert.equal(open.photos.length + open.floorPlans.length, 1);
  assert.ok(open.from.phone && open.from.email, 'the sender can be reached');
  assert.notEqual(open.photos[0].file, photo, 'a copy, never the listing’s own file');
  absent(open, [...PRIVATE, ...LOCATION, record.id, 'owner-front'], 'accepted');
  assert.equal(await fileStatus(teams.agent, share, open.photos[0].file), 200);
  assert.equal(await fileStatus(teams.agent, share, photo), 404, 'only files the snapshot names');
});

test('the exact location goes only when the sender switches it on', async () => {
  const record = await listing(teams);
  const open = await accepted(teams.one, record, teams.agent, { exactLocation: true });
  assert.equal(open.listing.unitReference, 'OS-UNIT-1');
  assert.equal(open.listing.mapLink, 'https://maps.example.test/os');
  absent(open, PRIVATE, 'with location');
});

test('what was reviewed is what is sent', async () => {
  const record = await listing(teams);
  const review = await preview(teams.one, record);
  const changed = await patch(teams.admin, 'Properties', record, {
    ...record.record,
    property_description: 'Bright villa, new kitchen',
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.value));
  const body = sendBody(record, teams.agent, review);
  const refused = await listingRequest(teams.one, '', { method: 'POST', body });
  assert.equal(refused.status, 409, JSON.stringify(refused.value));
  assert.match(refused.value.message, /changed/);
  const shares = query(`SELECT count(*) FROM agreements.crm_listing_shares
    WHERE source_record_id='${record.id}'`);
  assert.equal(shares, '0');
});

test('an unchanged listing sent to a second agent reuses its snapshot and copies', async () => {
  const photo = await stored('owner-back.jpg');
  const record = await listing(teams, 'one', {
    media_photos: [{ name: 'owner-back.jpg', type: 'image/jpeg', file: photo }],
  });
  const first = await send(teams.one, record, teams.agent);
  const second = await send(teams.one, record, teams.colleague);
  assert.equal(first.reference, second.reference);
  assert.deepEqual(first.photos, second.photos);
  const copies = query(`SELECT count(*) FROM media.crm_media_objects
    WHERE origin='copy' AND copied_from='${photo}' AND deleted_at IS NULL`);
  assert.equal(copies, '1');
});

test('lists, the badge and the first read are recorded for each side', async () => {
  const record = await listing(teams);
  const share = await send(teams.one, record, teams.colleague);
  const waiting = await teams.colleague.request(
    `/workspaces/${teams.colleague.user.workspaceId}/agreements/waiting`,
  );
  assert.ok(waiting.value.listings >= 1, JSON.stringify(waiting.value));
  const incoming = await listingRequest(teams.colleague, '?side=incoming');
  assert.ok(incoming.value.shares.some((row) => row.id === share.id));
  const mine = await listingRequest(teams.one, `?recordId=${record.id}`);
  assert.deepEqual(
    mine.value.shares.map((row) => row.id),
    [share.id],
  );
  const theirs = await listingRequest(teams.other, '?side=incoming');
  assert.ok(theirs.value.shares.some((row) => row.id === share.id && row.viewer === 'agentAdmin'));
  await read(teams.colleague, share);
  await read(teams.colleague, share);
  const opened = query(`SELECT count(*) FROM agreements.crm_listing_share_events
    WHERE share_id='${share.id}' AND action='opened'`);
  assert.equal(opened, '1');
});
