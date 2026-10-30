import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { market } from './marketplace-helpers.mjs';
import { client, postHeld, requestTeams } from './marketplace-request-helpers.mjs';
import { held } from './record-sharing-helpers.mjs';
import { listingRequest } from './outside-sharing-helpers.mjs';
import { setAssignee } from './assignment-helpers.mjs';

let teams;
let request;
let source;
let share;
let listing;
before(async () => {
  teams = await requestTeams('market-offer-access');
  source = await client(teams, 'one');
  request = await postHeld(teams.one, source.id);
  listing = await held(teams.other, teams.agent, 'Properties', {
    property_id: 'MK-ACCESS',
    listing_title: 'PRIVATE-UNIT-IN-TITLE',
    building_project: 'PRIVATE-BUILDING',
    unit_reference: 'PRIVATE-UNIT',
    sale_rental: 'Rental',
    property_type: 'Apartment',
    emirate: 'Dubai',
    community: 'Dubai Marina',
    bedrooms: '2',
    listing_status: 'Available',
    price_annual_rent_aed: '110000',
  });
  const preview = await market(teams.agent, `/requests/${request.id}/offers/preview`, {
    method: 'POST',
    body: { recordId: listing.id },
  });
  assert.equal(preview.status, 200, JSON.stringify(preview.value));
  const sent = await market(teams.agent, `/requests/${request.id}/offers`, {
    method: 'POST',
    body: { recordId: listing.id, previewDigest: preview.value.previewDigest, checked: true },
  });
  assert.equal(sent.status, 201, JSON.stringify(sent.value));
  share = sent.value.share;
});
const details = () => market(teams.one, `/requests/${request.id}/offers`);

test('recipient evidence redacts location, title and building; outsiders see generic not-found', async () => {
  const evidence = await listingRequest(teams.one, `/${share.id}/evidence`);
  assert.equal(evidence.status, 200, JSON.stringify(evidence.value));
  const text = JSON.stringify(evidence.value);
  for (const secret of ['PRIVATE-UNIT', 'PRIVATE-BUILDING'])
    assert.equal(text.includes(secret), false);
  assert.equal(
    (await listingRequest(teams.two, `/${share.id}/accept`, { method: 'POST' })).status,
    404,
  );
  assert.equal((await listingRequest(teams.two, `/${share.id}/evidence`)).status, 404);
});

test('temporary suspension hides facts without freeing the offer slot', async () => {
  query(`UPDATE crm_users SET active=false WHERE id='${teams.agent.user.id}'`);
  const paused = await details();
  assert.equal(paused.status, 200, JSON.stringify(paused.value));
  assert.equal(paused.value.request.activeOffers, 1);
  assert.equal(paused.value.answers[0].listing, null);
  assert.equal(paused.value.answers[0].state, 'waiting');
  query(`UPDATE crm_users SET active=true WHERE id='${teams.agent.user.id}'`);
  assert.notEqual((await details()).value.answers[0].listing, null);
});

test('a former holder loses facts and moved client removes the request from open cross-company reads', async () => {
  setAssignee(listing.id, teams.colleague.user.id);
  const former = await market(teams.agent, `/requests/${request.id}/offers`);
  assert.equal(former.status, 200);
  assert.equal(former.value.answers[0].listing, null);
  setAssignee(source.id, teams.two.user.id);
  assert.equal((await market(teams.colleague, `/requests/${request.id}/offers`)).status, 404);
  setAssignee(source.id, teams.one.user.id);
});

test('expired shares reconcile before response and persistently free capacity', async () => {
  const old = (await details()).value.answers[0];
  if (old.state === 'waiting')
    await market(teams.one, `/requests/${request.id}/offers/${old.id}/reject`, { method: 'POST' });
  const fresh = await held(teams.other, teams.agent, 'Properties', {
    property_id: 'MK-EXPIRE',
    sale_rental: 'Rental',
    property_type: 'Apartment',
    emirate: 'Dubai',
    community: 'Dubai Marina',
    bedrooms: '2',
    listing_status: 'Available',
    price_annual_rent_aed: '110000',
  });
  const preview = await market(teams.agent, `/requests/${request.id}/offers/preview`, {
    method: 'POST',
    body: { recordId: fresh.id },
  });
  assert.equal(preview.status, 200, JSON.stringify(preview.value));
  const sent = await market(teams.agent, `/requests/${request.id}/offers`, {
    method: 'POST',
    body: { recordId: fresh.id, previewDigest: preview.value.previewDigest, checked: true },
  });
  assert.equal(sent.status, 201, JSON.stringify(sent.value));
  const freshShare = sent.value.share;
  assert.equal((await details()).value.request.activeOffers, 1);
  // Disposable fixture clock shift, matching existing outside-sharing lifecycle tests.
  query(
    `SET session_replication_role=replica; UPDATE agreements.crm_listing_shares SET created_at=created_at-interval '16 days',offer_ends_at=offer_ends_at-interval '16 days',view_ends_at=view_ends_at-interval '16 days' WHERE id='${freshShare.id}'`,
  );
  const result = await details();
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.equal(result.value.request.activeOffers, 0);
  const expired = result.value.answers.find((answer) => answer.shareId === freshShare.id);
  assert.equal(expired.state, 'ended');
  assert.equal(expired.listing, null);
  assert.equal(
    query(`SELECT state FROM marketplace.crm_market_answers WHERE share_id='${freshShare.id}'`),
    'ended',
  );
  const closed = await market(teams.one, `/requests/${request.id}/close`, { method: 'POST' });
  assert.equal(closed.status, 200, JSON.stringify(closed.value));
});
