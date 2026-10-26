import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { market } from './marketplace-helpers.mjs';
import { client, postHeld, requestTeams } from './marketplace-request-helpers.mjs';
import { held } from './record-sharing-helpers.mjs';

let teams;
let request;
let listing;
let share;
before(async () => {
  teams = await requestTeams('market-offers');
  request = await postHeld(teams.one, (await client(teams, 'one')).id);
  listing = await held(teams.other, teams.agent, 'Properties', {
    property_id: 'MK-OFFER-1',
    listing_title: 'Synthetic matching listing',
    sale_rental: 'Rental',
    property_type: 'Apartment',
    emirate: 'Dubai',
    community: 'Dubai Marina',
    bedrooms: '2',
    listing_status: 'Available',
    price_annual_rent_aed: '110000',
    unit_reference: 'DO-NOT-EXPOSE-UNIT',
  });
});
const offers = (who) => market(who, `/requests/${request.id}/offers`);
const preview = () =>
  market(teams.agent, `/requests/${request.id}/offers/preview`, {
    method: 'POST',
    body: { recordId: listing.id },
  });
const send = (digest) =>
  market(teams.agent, `/requests/${request.id}/offers`, {
    method: 'POST',
    body: { recordId: listing.id, previewDigest: digest, checked: true },
  });

test('matching is server-owned and reviewed snapshots keep exact location sealed', async () => {
  const own = await offers(teams.agent);
  assert.equal(own.status, 200, JSON.stringify(own.value));
  assert.ok(own.value.matches.some((item) => item.recordId === listing.id));
  assert.equal(own.value.request.canMessage, false);
  const draft = await preview();
  assert.equal(draft.status, 200, JSON.stringify(draft.value));
  assert.equal((await send('stale-digest')).status, 409);
  const sent = await send(draft.value.previewDigest);
  assert.equal(sent.status, 201, JSON.stringify(sent.value));
  share = sent.value.share.id;
  const poster = await offers(teams.one);
  assert.equal(poster.value.request.activeOffers, 1);
  assert.equal(poster.value.answers.length, 1);
  assert.equal(JSON.stringify(poster.value).includes('DO-NOT-EXPOSE-UNIT'), false);
  assert.equal((await send(draft.value.previewDigest)).status, 409);
  for (const action of ['accept', 'decline', 'withdraw', 'stop', 'extend', 'co-broking']) {
    const who = ['accept', 'decline'].includes(action) ? teams.one : teams.agent;
    const result = await who.request(
      `/workspaces/${who.user.workspaceId}/agreements/listing-shares/${share}/${action}`,
      { method: 'POST', ...(action === 'extend' ? { body: { viewEndsOn: '2099-01-01' } } : {}) },
    );
    assert.equal(result.status, 409, `${action}: ${JSON.stringify(result.value)}`);
  }
});

test('only poster can reject; rejection releases capacity and retains private history', async () => {
  const before = await offers(teams.one);
  const answer = before.value.answers[0].id;
  const path = `/requests/${request.id}/offers/${answer}/reject`;
  assert.equal((await market(teams.admin, path, { method: 'POST' })).status, 404);
  assert.equal((await market(teams.one, path, { method: 'POST' })).status, 200);
  const after = await offers(teams.one);
  assert.equal(after.value.request.activeOffers, 0);
  assert.equal(after.value.answers[0].state, 'not_a_match');
  assert.equal(after.value.answers[0].listing, null);
  assert.ok(share);
});
