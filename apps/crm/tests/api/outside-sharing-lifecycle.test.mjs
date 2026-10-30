import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import {
  accepted,
  act,
  canonical,
  dubaiDay,
  evidence,
  listing,
  outsideTeams,
  read,
  send,
  sha256,
  stored,
} from './outside-sharing-helpers.mjs';

// R2a steps: withdraw, decline, stop, extend, and the end of an offer or a share in time.
let teams;
before(async () => {
  teams = await outsideTeams('outside-lifecycle');
});

/** Moves a share and its events back in time by `days` (the guard is bypassed here only). */
const backdate = (share, days) =>
  query(`SET session_replication_role = replica; UPDATE agreements.crm_listing_shares SET
    created_at=created_at-interval '${days} days',offer_ends_at=offer_ends_at-interval '${days} days',
    view_ends_at=view_ends_at-interval '${days} days',
    decided_at=decided_at-interval '${days} days' WHERE id='${share.id}'`);

test('the sender withdraws a pending offer, and the agent may decline as already known', async () => {
  const withdrawn = await send(teams.one, await listing(teams), teams.agent);
  assert.equal((await act(teams.admin, withdrawn, 'withdraw')).status, 200, 'the Admin may');
  assert.equal((await act(teams.agent, withdrawn, 'accept')).status, 409);
  assert.equal((await read(teams.agent, withdrawn)).listing, null);
  const declined = await send(teams.one, await listing(teams), teams.agent);
  const answer = await act(teams.agent, declined, 'decline', { alreadyKnown: true });
  assert.equal(answer.status, 200, JSON.stringify(answer.value));
  assert.equal(answer.value.share.declinedAsKnown, true);
  const proof = await evidence(teams.one, declined);
  const event = proof.evidence.events.find((entry) => entry.action === 'declined');
  assert.equal(event.reason, 'already_known');
  assert.equal(event.side, 'recipient');
});

test('an accepted share is extended within ninety days and then stopped', async () => {
  const share = await accepted(teams.one, await listing(teams), teams.agent, { days: 10 });
  const later = await act(teams.one, share, 'extend', { viewEndsOn: dubaiDay(60) });
  assert.equal(later.status, 200, JSON.stringify(later.value));
  assert.ok(later.value.share.viewEndsAt > share.viewEndsAt);
  for (const day of [dubaiDay(20), dubaiDay(91), 'soon']) {
    const refused = await act(teams.one, share, 'extend', { viewEndsOn: day });
    assert.equal(refused.status, 400, day);
  }
  const stopped = await act(teams.one, share, 'stop');
  assert.equal(stopped.value.share.status, 'stopped');
  assert.equal(stored(share), 'stopped|-');
  assert.equal((await act(teams.one, share, 'stop')).status, 409);
  const actions = (await evidence(teams.one, share)).evidence.events.map((entry) => entry.action);
  assert.deepEqual(actions, ['sent', 'accepted', 'extended', 'stopped']);
});

test('an unanswered offer expires at its fourteenth day, with that time as evidence', async () => {
  const share = await send(teams.one, await listing(teams), teams.agent);
  backdate(share, 15);
  const expired = await read(teams.agent, share);
  assert.equal(expired.status, 'expired');
  assert.equal(expired.listing, null);
  assert.equal((await act(teams.agent, share, 'accept')).status, 409);
  assert.equal(stored(share), 'expired|-');
  const proof = await evidence(teams.one, share);
  const event = proof.evidence.events.find((entry) => entry.action === 'expired');
  assert.equal(event.at, proof.evidence.share.offerEndsAt);
});

test('an accepted share ends on its last day', async () => {
  const share = await accepted(teams.one, await listing(teams), teams.agent, { days: 5 });
  backdate(share, 7);
  const ended = await read(teams.agent, share);
  assert.equal(`${ended.status}|${ended.endReason}`, 'ended|end_date');
  assert.equal(ended.listing, null);
  assert.equal((await act(teams.one, share, 'stop')).status, 409);
  assert.equal(stored(share), 'ended|end_date');
  const proof = await evidence(teams.one, share);
  const event = proof.evidence.events.find((entry) => entry.action === 'ended');
  assert.equal(event.at, proof.evidence.share.viewEndsAt);
});

test('the acceptance records a digest anyone can recompute from the evidence', async () => {
  const share = await accepted(teams.one, await listing(teams), teams.agent, { note: 'Hi' });
  const { evidence: proof } = await evidence(teams.agent, share);
  const { share: row, snapshot } = proof;
  const digest = sha256(
    canonical({
      scheme: 1,
      shareId: row.id,
      snapshotDigest: snapshot.digest,
      sender: row.sender,
      recipient: row.recipient,
      sentAt: row.sentAt,
      viewEndsAt: row.viewEndsAt,
      note: row.note,
    }),
  );
  assert.equal(row.acceptedDigest, digest);
  assert.equal(snapshot.facts, undefined, 'the agent side gets the twelve facts only');
  assert.ok(snapshot.basicFacts.listingTitle);
  const full = (await evidence(teams.one, share)).evidence.snapshot;
  const location = sha256(
    `${full.locationSalt}\nOS-UNIT-1\nSynthetic Street 9\nhttps://maps.example.test/os`,
  );
  assert.equal(full.locationDigest, location, 'the sender proves the unit without showing it');
  const recomputed = sha256(
    canonical({
      scheme: 1,
      facts: full.facts,
      files: full.files,
      exactLocation: full.exactLocation,
      locationDigest: full.locationDigest,
    }),
  );
  assert.equal(recomputed, snapshot.digest);
});
