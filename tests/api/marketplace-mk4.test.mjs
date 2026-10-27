import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  selectedFixture,
  offers,
  propose,
  mk4Terms,
  act,
  detail,
  ok,
  market,
} from './marketplace-mk4-helpers.mjs';
import { query } from './helpers.mjs';
import { listingRequest } from './outside-sharing-helpers.mjs';
let fixture;
let agreement;
before(async () => {
  fixture = await selectedFixture('market-mk4');
});

test('selected offer creates an anonymous sealed draft and releases nothing before acceptance', async () => {
  const { teams, request } = fixture;
  const view = ok(await offers(teams.one, request));
  assert.equal(view.request.canProposeAgreement, true);
  assert.equal(view.answers[0].release.released, false);
  assert.equal((await propose(teams.agent, request)).status, 404);
  for (const invalid of [null, 1, [], 'bad'])
    assert.equal((await propose(teams.one, request, invalid)).status, 400);
  agreement = ok(await propose(teams.one, request), 201).agreement;
  const draft = await detail(teams.one, agreement.id);
  assert.equal(draft.marketplace, true);
  assert.deepEqual(draft.revision.terms.subject.client, {
    displayName: 'Marketplace client',
    contact: null,
  });
  assert.equal(JSON.stringify(draft).includes('PRIVATE-UNIT'), false);
  assert.equal((await propose(teams.one, request)).status, 409);
  ok(await act(teams.one, agreement.id, 'send'));
  assert.equal(ok(await offers(teams.agent, request)).answers[0].release.released, false);
});

test('counter acceptance records one exact release, then both named brokers read private details', async () => {
  const { teams, request, share } = fixture;
  ok(await act(teams.agent, agreement.id, 'counter', { terms: mk4Terms() }));
  const counter = await detail(teams.one, agreement.id);
  assert.deepEqual(counter.revision.terms.subject.client, {
    displayName: 'Marketplace client',
    contact: null,
  });
  ok(await act(teams.one, agreement.id, 'accept'));
  for (const person of [teams.one, teams.agent]) {
    const release = ok(await offers(person, request)).answers[0].release;
    assert.equal(release.released, true);
    assert.equal(release.listing.unitReference, 'PRIVATE-UNIT-MK4');
    assert.ok(release.contacts.requester.phone);
    assert.ok(release.contacts.broker.phone);
  }
  const generic = await listingRequest(teams.one, `/${share.id}`);
  assert.equal(generic.value.share.listing.unitReference, 'PRIVATE-UNIT-MK4');
  const admin = await listingRequest(teams.admin, `/${share.id}`);
  assert.equal(JSON.stringify(admin.value).includes('PRIVATE-UNIT'), false);
  assert.equal((await act(teams.one, agreement.id, 'accept')).status, 409);
  assert.equal(
    query(
      `SELECT count(*) FROM agreements.crm_market_releases WHERE agreement_id='${agreement.id}'`,
    ),
    '1',
  );
  assert.equal(
    query(
      `SELECT revision_id::text FROM agreements.crm_market_releases WHERE agreement_id='${agreement.id}'`,
    ),
    counter.revision.id,
  );
});

test('accepted agreement prevents silent reopen; completion updates both public broker stats', async () => {
  const { teams, request } = fixture;
  const version = ok(await offers(teams.one, request)).request.version;
  const reopened = await market(teams.one, `/requests/${request.id}/reopen`, {
    method: 'POST',
    body: { expectedVersion: version },
  });
  assert.equal(reopened.status, 409);
  ok(await act(teams.one, agreement.id, 'complete'));
  for (const person of [teams.one, teams.agent]) {
    const result = await market(teams.colleague, `/profiles/${person.user.id}`);
    assert.equal(result.status, 200, JSON.stringify(result.value));
    assert.equal(result.value.profile.stats.acceptedAgreements, 1);
    assert.equal(result.value.profile.stats.completedDeals, 1);
    assert.equal(result.value.profile.stats.completionRate, 100);
    assert.equal(result.value.profile.stats.disputesLost, null);
  }
  ok(await market(teams.one, `/requests/${request.id}/close`, { method: 'POST' }));
  assert.equal(ok(await offers(teams.agent, request)).answers[0].release.released, true);
});

test('reopening an unaccepted agreement stops its share and keeps the proposal as evidence', async () => {
  const { teams, request, share } = await selectedFixture('mk4-reopen-sent');
  const draft = ok(await propose(teams.one, request), 201).agreement;
  ok(await act(teams.one, draft.id, 'send'));
  const version = ok(await offers(teams.one, request)).request.version;
  const reopened = await market(teams.one, `/requests/${request.id}/reopen`, {
    method: 'POST',
    body: { expectedVersion: version },
  });
  assert.equal(reopened.status, 200, JSON.stringify(reopened.value));
  assert.equal(
    query(`SELECT status FROM agreements.crm_listing_shares WHERE id='${share.id}'`),
    'stopped',
  );
  assert.equal((await detail(teams.one, draft.id)).agreement.state, 'sent');
});
