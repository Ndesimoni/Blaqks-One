import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { act as agree, detail, ok } from './agreements-a3b-helpers.mjs';
import { terms } from './agreements-helpers.mjs';
import { query } from './helpers.mjs';
import {
  accepted,
  act,
  evidence,
  listing,
  listingRequest,
  outsideTeams,
  read,
  send,
} from './outside-sharing-helpers.mjs';

// Co-broking from a listing share (docs/record-sharing.md R2, "Turning it into co-broking").
let teams;
before(async () => {
  teams = await outsideTeams('outside-cobroking');
});

const money = (senderShareBp = 5000) => ({
  basis: 'commission',
  amountFils: 5250000,
  senderShareBp,
  paymentExpectation: 'on_transfer',
  collectingParty: 'sender',
});
const propose = (session, share, body = terms({ money: money() })) =>
  listingRequest(session, `/${share.id}/co-broking`, { method: 'POST', body: { terms: body } });

test('the agent proposes co-broking with the shared listing and introduction fixed', async () => {
  const record = await listing(teams, 'one', {
    property_type: 'Villa',
    area_sq_ft: '2400',
    price_annual_rent_aed: '3500000',
  });
  const share = await accepted(teams.one, record, teams.agent);
  const offered = await read(teams.agent, share);
  assert.equal(offered.allowed.coBroking, true);
  assert.equal(offered.coBrokingProperty.listingRef, share.reference);
  const made = ok(await propose(teams.agent, share), 201).agreement;
  assert.deepEqual([made.kind, made.state, made.origin], ['co_broking', 'draft', 'direct']);
  assert.equal(made.recipientMemberId, teams.one.user.id, 'offered to the person who shared');
  const { terms: frozen } = (await detail(teams.agent, made.id)).revision;
  assert.deepEqual(frozen.subject.property, {
    emirate: 'Dubai',
    area: 'Dubai Hills',
    propertyType: 'Villa',
    bedrooms: 3,
    sizeSqft: 2400,
    askingPriceFils: 350000000,
    listingRef: share.reference,
  });
  const { snapshot } = (await evidence(teams.agent, share)).evidence;
  assert.deepEqual(frozen.introduction, {
    reference: share.reference,
    snapshotDigest: snapshot.digest,
    sharedAt: share.createdAt,
    acceptedAt: share.decidedAt,
  });
  const mine = await read(teams.agent, share);
  assert.deepEqual(mine.coBroking, { id: made.id, state: 'draft' });
  assert.equal(mine.allowed.coBroking, false);
  const theirs = await read(teams.one, share);
  assert.equal(theirs.coBroking, null, 'a draft stays private to its writer');
  const converted = query(`SELECT count(*) FROM agreements.crm_listing_share_events
    WHERE share_id='${share.id}' AND action='converted' AND side='recipient'`);
  assert.equal(converted, '1');
});

test('only the two named people of an accepted, open share may propose', async () => {
  const pending = await send(teams.one, await listing(teams), teams.agent);
  assert.equal((await propose(teams.agent, pending)).status, 409);
  const share = await accepted(teams.one, await listing(teams), teams.agent);
  for (const outsider of [teams.other, teams.admin, teams.two, teams.colleague]) {
    assert.equal((await propose(outsider, share)).status, 404, outsider.user.email);
  }
  const unnamed = terms({ money: { ...money(), collectingParty: undefined } });
  assert.equal((await propose(teams.agent, share, unnamed)).status, 400);
  assert.equal((await act(teams.one, share, 'stop')).status, 200);
  assert.equal((await propose(teams.agent, share)).status, 409);
});

test('one standing agreement per share, and every revision keeps the introduction', async () => {
  const share = await accepted(teams.one, await listing(teams), teams.agent);
  const first = ok(await propose(teams.agent, share), 201).agreement;
  const again = await propose(teams.agent, share);
  assert.equal(again.status, 409);
  assert.match(again.value.message, /already have a draft/);
  const rival = ok(await propose(teams.one, share), 201).agreement;
  ok(await agree(teams.agent, first.id, 'send'));
  const refused = await agree(teams.one, rival.id, 'send');
  assert.equal(refused.status, 409, JSON.stringify(refused.value));
  assert.match(refused.value.message, /already a co-broking agreement/);
  const other = terms({ money: money(4000) });
  other.property = { ...other.property, area: 'Elsewhere', listingRef: 'AG-FAKE' };
  ok(await agree(teams.one, first.id, 'counter', { terms: other }));
  const view = await detail(teams.one, first.id);
  assert.equal(view.revision.number, 2);
  assert.equal(view.revision.terms.money.senderShareBp, 4000);
  assert.equal(view.revision.terms.subject.property.listingRef, share.reference);
  assert.equal(view.revision.terms.subject.property.area, 'Dubai Hills');
  const introductions = query(`SELECT count(DISTINCT terms->'introduction')
    FROM agreements.crm_agreement_revisions WHERE agreement_id='${first.id}'`);
  assert.equal(introductions, '1', 'the counter-offer keeps the introduction');
  assert.equal((await read(teams.one, share)).coBroking.state, 'sent');
  assert.throws(
    () =>
      query(`UPDATE agreements.crm_agreements SET listing_share_id=NULL,version=version+1
        WHERE id='${first.id}'`),
    /identity/,
  );
});
