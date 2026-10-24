import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  board,
  client,
  closeRequest,
  postHeld,
  requestTeams,
  seedRequests,
} from './marketplace-request-helpers.mjs';

// The board: paging, filters and what a card may carry (docs/broker-marketplace.md §3, packet MK2).
let teams;
let seeded;
before(async () => {
  teams = await requestTeams('market-board');
  seeded = await seedRequests(teams, 21);
});

const ALLOWED = [
  'bedrooms',
  'broker',
  'budgetBand',
  'buildingAge',
  'cheques',
  'communities',
  'createdAt',
  'emirate',
  'expiresAt',
  'furnishing',
  'id',
  'moveIn',
  'openToOtherAreas',
  'propertyType',
  'purpose',
  'ready',
  'yourCompany',
];

test('twenty per page, an opaque cursor, no totals and no repeats', async () => {
  const first = await board(teams.two);
  assert.equal(first.status, 200, JSON.stringify(first.value));
  assert.equal(first.value.requests.length, 20);
  assert.equal(typeof first.value.nextCursor, 'string');
  assert.equal(first.value.total, undefined);
  assert.equal(first.value.count, undefined);
  const second = await board(teams.two, { cursor: first.value.nextCursor });
  assert.equal(second.status, 200, JSON.stringify(second.value));
  assert.equal(second.value.requests.length, 1);
  assert.equal(second.value.nextCursor, null);
  const ids = [...first.value.requests, ...second.value.requests].map((row) => row.id);
  assert.equal(new Set(ids).size, 21);
  assert.deepEqual(new Set(ids), new Set(seeded));
});

test('a card carries the request and the broker, never the client or the budget', async () => {
  const seen = await board(teams.two, { bedrooms: 2 });
  const card = seen.value.requests[0];
  assert.deepEqual(Object.keys(card).sort(), ALLOWED);
  assert.equal(card.budgetBand, 'rent_150k');
  assert.equal(card.budgetMaxAed, undefined);
  assert.equal(card.budgetMinAed, undefined);
  assert.equal(card.clientId, undefined);
  assert.deepEqual(card.communities, []);
  assert.equal(card.broker.name, teams.agent.user.name);
  assert.equal(card.broker.company, teams.other.user.name);
  assert.equal(card.broker.hasPhoto, false);
  assert.equal(card.yourCompany, false);
  assert.equal(typeof card.broker.memberId, 'string');
  const text = JSON.stringify(seen.value);
  for (const secret of ['Synthetic Request Client', '050 123', 'synthetic.client@', 'Portal'])
    assert.equal(text.includes(secret), false, secret);
});

test('the filters narrow on the server', async () => {
  await seedRequests(teams, 1, { purpose: 'buy', emirate: 'sharjah', budget_band: 'buy_3m' });
  const buying = await board(teams.two, { purpose: 'buy' });
  assert.equal(buying.status, 200, JSON.stringify(buying.value));
  assert.ok(buying.value.requests.length >= 1);
  for (const card of buying.value.requests) assert.equal(card.purpose, 'buy');
  const sharjah = await board(teams.two, { emirate: 'sharjah', band: 'buy_3m' });
  assert.ok(sharjah.value.requests.every((card) => card.emirate === 'sharjah'));
  const none = await board(teams.two, { purpose: 'buy', emirate: 'dubai' });
  assert.equal(none.value.requests.length, 0);
});

test('a closed request never appears on the board', async () => {
  const posted = await postHeld(teams.other, (await client(teams, 'other')).id);
  const seen = await board(teams.two);
  assert.equal(
    seen.value.requests.some((card) => card.id === posted.id),
    true,
  );
  assert.equal((await closeRequest(teams.other, posted.id)).status, 200);
  const closed = await board(teams.two);
  assert.equal(
    closed.value.requests.some((card) => card.id === posted.id),
    false,
  );
});
