import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import {
  approvedCompany,
  currentTerms,
  editProfile,
  join,
  joinBody,
  leave,
  market,
  marketTeams,
  readProfile,
  termsOf,
} from './marketplace-helpers.mjs';

// Joining, terms, editing and leaving (docs/broker-marketplace.md §2 and §14, packet MK1b).
let teams;
before(async () => {
  teams = await marketTeams('market-join');
  await approvedCompany(teams.admin, teams.owner);
});

const profile = (overrides = {}) => ({
  emirates: ['dubai', 'sharjah'],
  communities: ['Dubai Marina'],
  propertyTypes: ['residential_sale', 'residential_rent'],
  experienceYears: 9,
  licence: null,
  ...overrides,
});

test('the current terms are readable and bound to their digest', async () => {
  const terms = await termsOf(teams.admin);
  assert.equal(terms.version, '2026-10-24.1');
  assert.equal(terms.commitments.length, 4);
  assert.match(terms.digest, /^[a-f0-9]{64}$/);
  assert.equal(terms.draft, true);
  assert.match(terms.body, /lawyer review/);
  assert.match(terms.consent, /shown to members of every company/);
});

test('a missing tick, missing consent, stale version or digest are refused', async () => {
  const terms = await currentTerms(teams.one);
  const noTick = await join(teams.one, joinBody(terms, { commitments: [true, true, true, false] }));
  assert.equal(noTick.status, 400, JSON.stringify(noTick.value));
  const noConsent = await join(teams.one, joinBody(terms, { consent: false }));
  assert.equal(noConsent.status, 400, JSON.stringify(noConsent.value));
  const stale = await join(teams.one, joinBody(terms, { termsVersion: '2026-01-01.1' }));
  assert.equal(stale.status, 409, JSON.stringify(stale.value));
  assert.match(stale.value.message, /current marketplace terms/);
  const changed = await join(teams.one, joinBody(terms, { termsDigest: 'a'.repeat(64) }));
  assert.equal(changed.status, 409, JSON.stringify(changed.value));
  const bad = await join(
    teams.one,
    joinBody(terms, { profile: profile({ communities: ['Call 050 123 4567'] }) }),
  );
  assert.equal(bad.status, 400, JSON.stringify(bad.value));
});

test('a member joins once, then edits with the version they last saw', async () => {
  const terms = await currentTerms(teams.one);
  const joined = await join(teams.one, joinBody(terms));
  assert.equal(joined.status, 201, JSON.stringify(joined.value));
  const member = joined.value.status.member;
  assert.equal(member.joined, true);
  assert.equal(member.termsCurrent, true);
  assert.deepEqual(member.profile.communities, ['Dubai Marina', 'JVC']);
  assert.equal(member.profile.version, 1);
  const twice = await join(teams.one, joinBody(terms));
  assert.equal(twice.status, 409, JSON.stringify(twice.value));
  const edited = await editProfile(teams.one, 1, profile());
  assert.equal(edited.status, 200, JSON.stringify(edited.value));
  assert.equal(edited.value.status.member.profile.version, 2);
  assert.deepEqual(edited.value.status.member.profile.emirates, ['dubai', 'sharjah']);
  const stale = await editProfile(teams.one, 1, profile());
  assert.equal(stale.status, 409, JSON.stringify(stale.value));
});

test('leaving removes the profile, and joining again asks for everything', async () => {
  const terms = await currentTerms(teams.one);
  await join(teams.two, joinBody(await currentTerms(teams.two)));
  const left = await leave(teams.one);
  assert.equal(left.status, 200, JSON.stringify(left.value));
  assert.equal(left.value.status.member.joined, false);
  assert.equal((await readProfile(teams.two, teams.one.user.id)).status, 404);
  const noConsent = await join(teams.one, joinBody(terms, { consent: false }));
  assert.equal(noConsent.status, 400, JSON.stringify(noConsent.value));
  const again = await join(teams.one, joinBody(terms));
  assert.equal(again.status, 201, JSON.stringify(again.value));
  assert.equal(again.value.status.member.profile.version, 1);
});

test('a newer terms version blocks edits until it is accepted', async () => {
  // The digest the server recomputes: SHA-256 of the compact JSON with sorted keys.
  const text = { body: 'New body.', commitments: ['a', 'b', 'c', 'd'], consent: 'New consent.' };
  const canonical = JSON.stringify({ ...text, version: '2099-01-01.1' });
  const digest = createHash('sha256').update(canonical).digest('hex');
  query(
    `INSERT INTO marketplace.crm_market_terms (version,body,consent,commitments,digest,draft,published_at) ` +
      `VALUES ('2099-01-01.1','New body.','New consent.','["a","b","c","d"]','${digest}',false,clock_timestamp())`,
  );
  const state = (await market(teams.one, '/status')).value;
  assert.equal(state.member.termsCurrent, false);
  assert.equal(state.member.termsVersion, '2099-01-01.1');
  const version = state.member.profile.version;
  const blocked = await editProfile(teams.one, version, profile());
  assert.equal(blocked.status, 409, JSON.stringify(blocked.value));
  const accepted = await market(teams.one, '/terms/accept', {
    method: 'POST',
    body: {
      termsVersion: '2099-01-01.1',
      termsDigest: digest,
      commitments: [true, true, true, true],
      consent: true,
    },
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.value));
  assert.equal(accepted.value.status.member.termsCurrent, true);
  const edited = await editProfile(teams.one, version, profile());
  assert.equal(edited.status, 200, JSON.stringify(edited.value));
});
