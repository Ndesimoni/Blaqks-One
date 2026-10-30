import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { market, switchCompany } from './marketplace-helpers.mjs';
import {
  board,
  client,
  draft,
  editRequest,
  mine,
  postHeld,
  postRequest,
  requestTeams,
} from './marketplace-request-helpers.mjs';

// Posting, the draft allowlist, the limits and editing (docs/broker-marketplace.md §3, packet MK2).
let teams;
before(async () => {
  teams = await requestTeams('market-request');
});

const secrets = (record) => [
  record.record.full_name,
  '050 123 4567',
  'synthetic.client@example.test',
  'Synthetic private note',
  'Portal',
  record.id,
];

test('the draft pre-fills only the allowed requirements', async () => {
  const record = await client(teams, 'one');
  const result = await draft(teams.one, record.id);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  const requirements = result.value.requirements;
  assert.equal(requirements.purpose, 'rent');
  assert.equal(requirements.emirate, 'dubai');
  assert.deepEqual(requirements.communities, ['Dubai Marina', 'JVC']);
  assert.equal(requirements.propertyType, 'Apartment');
  assert.equal(requirements.bedrooms, 2);
  assert.equal(requirements.budgetMinAed, 90_000);
  assert.equal(requirements.budgetMaxAed, 120_000);
  assert.equal(requirements.moveIn, '2026-11');
  const text = JSON.stringify(result.value);
  for (const secret of secrets(record)) assert.equal(text.includes(secret), false, secret);
});

test('a client the poster does not hold is refused, and the Admin may post for any', async () => {
  const record = await client(teams, 'two');
  const refused = await draft(teams.one, record.id);
  assert.equal(refused.status, 404, JSON.stringify(refused.value));
  const posted = await postRequest(teams.admin, record.id);
  assert.equal(posted.status, 201, JSON.stringify(posted.value));
});

test('posting needs the consent tick and valid fields', async () => {
  const record = await client(teams, 'two');
  const noConsent = await postRequest(teams.two, record.id, {}, { clientConsent: false });
  assert.equal(noConsent.status, 400, JSON.stringify(noConsent.value));
  assert.match(noConsent.value.message, /client must agree/);
  const noBudget = await postRequest(teams.two, record.id, { budgetMaxAed: 0 });
  assert.equal(noBudget.status, 400, JSON.stringify(noBudget.value));
  const badCheques = await postRequest(teams.two, record.id, { cheques: 5 });
  assert.equal(badCheques.status, 400, JSON.stringify(badCheques.value));
  const contact = await postRequest(teams.two, record.id, { communities: ['Marina 050 123 4567'] });
  assert.equal(contact.status, 400, JSON.stringify(contact.value));
  const posted = await postHeld(teams.two, record.id);
  assert.equal(posted.budgetBand, 'rent_150k');
  assert.equal(posted.state, 'open');
  assert.equal(posted.broker, undefined);
  assert.equal(posted.clientId, record.id, 'the poster sees their own client');
});

test('five open requests per member, and one per client', async () => {
  const records = [];
  for (let index = 0; index < 5; index += 1) records.push(await client(teams, 'one'));
  for (const record of records) await postHeld(teams.one, record.id);
  const refused = await postRequest(teams.one, (await client(teams, 'one')).id);
  assert.equal(refused.status, 409, JSON.stringify(refused.value));
  assert.match(refused.value.message, /five open requests/);
  const twice = await postRequest(teams.one, records[0].id);
  assert.equal(twice.status, 409, JSON.stringify(twice.value));
  assert.match(twice.value.message, /already has an open request/);
});

test('closing a request frees its client, and My requests shows it closed', async () => {
  const record = await client(teams, 'admin');
  const posted = await postHeld(teams.admin, record.id);
  const closed = await market(teams.admin, `/requests/${posted.id}/close`, { method: 'POST' });
  assert.equal(closed.status, 200, JSON.stringify(closed.value));
  assert.equal(closed.value.request.state, 'closed');
  const row = (await mine(teams.admin)).value.requests.find((item) => item.id === posted.id);
  assert.equal(row.state, 'closed');
  assert.equal(row.canRenew, false);
  const again = await postRequest(teams.admin, record.id);
  assert.equal(again.status, 201, JSON.stringify(again.value));
});

test('an edit keeps the expiry date and needs the version last seen', async () => {
  const record = await client(teams, 'admin');
  const posted = await postHeld(teams.admin, record.id);
  const edited = await editRequest(teams.admin, posted.id, posted.version, {
    purpose: 'buy',
    cheques: null,
    budgetMaxAed: 2_500_000,
  });
  assert.equal(edited.status, 200, JSON.stringify(edited.value));
  assert.equal(edited.value.request.budgetBand, 'buy_3m');
  assert.equal(edited.value.request.expiresAt, posted.expiresAt);
  assert.equal(edited.value.request.version, posted.version + 1);
  const stale = await editRequest(teams.admin, posted.id, posted.version, {});
  assert.equal(stale.status, 409, JSON.stringify(stale.value));
  const stranger = await editRequest(teams.two, posted.id, posted.version + 1, {});
  assert.equal(stranger.status, 404, JSON.stringify(stranger.value));
});

test('the board lists other companies and marks your own company', async () => {
  const theirs = await postHeld(teams.agent, (await client(teams, 'agent')).id);
  const seen = await board(teams.two);
  assert.equal(seen.status, 200, JSON.stringify(seen.value));
  const cards = new Map(seen.value.requests.map((row) => [row.id, row]));
  assert.equal(cards.get(theirs.id)?.yourCompany, false);
  const own = (await mine(teams.one)).value.requests.filter((row) => row.state === 'open');
  assert.ok(own.length > 0);
  for (const row of own) assert.equal(cards.get(row.id)?.yourCompany, true, row.id);
  const text = JSON.stringify(seen.value);
  for (const row of own.filter((one) => one.clientName))
    assert.equal(text.includes(row.clientName), false, 'client named');
  const off = await switchCompany(teams.other, false, 0);
  assert.equal(off.status, 200, JSON.stringify(off.value));
  const hidden = await board(teams.two);
  assert.equal(
    hidden.value.requests.some((row) => row.id === theirs.id),
    false,
  );
  assert.equal((await switchCompany(teams.other, true, 1)).status, 200);
});

test('a mistyped filter is refused rather than showing the whole board', async () => {
  for (const filters of [
    { purpose: 'swap' },
    { emirate: 'riyadh' },
    { propertyType: 'Castle' },
    { bedrooms: 21 },
    { band: 'buy_99m' },
    { cursor: 'not-a-cursor' },
  ]) {
    const refused = await board(teams.two, filters);
    assert.equal(refused.status, 400, JSON.stringify(refused.value));
  }
});
