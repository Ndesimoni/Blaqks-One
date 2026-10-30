import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import {
  board,
  client,
  closeRequest,
  postHeld,
  postRequest,
  requestTeams,
  seedRequests,
} from './marketplace-request-helpers.mjs';

// Claude's review of MK2 (2026-10-24): closing twice, an expired request holding its client,
// two posters racing for one client, "any bedrooms" under a bedroom filter, and board pages
// whose requests share one millisecond.
let teams;
before(async () => {
  teams = await requestTeams('market-fixes');
});

const events = (member) =>
  Number(
    query(
      `SELECT count(*) FROM marketplace.crm_market_events ` +
        `WHERE member_id='${member}' AND action='request_closed'`,
    ),
  );

test('a closed request cannot be closed again or gain a second closing event', async () => {
  const posted = await postHeld(teams.two, (await client(teams, 'two')).id);
  const before = events(teams.two.user.id);
  assert.equal((await closeRequest(teams.two, posted.id)).status, 200);
  const again = await closeRequest(teams.two, posted.id);
  assert.equal(again.status, 409, JSON.stringify(again.value));
  assert.equal(events(teams.two.user.id), before + 1);
});

test('an expired request frees its client for a new request', async () => {
  const record = await client(teams, 'one');
  const old = await postHeld(teams.one, record.id);
  query(
    `UPDATE marketplace.crm_market_requests SET expires_at=now()-interval '40 days' ` +
      `WHERE id='${old.id}'`,
  );
  const fresh = await postRequest(teams.one, record.id);
  assert.equal(fresh.status, 201, JSON.stringify(fresh.value));
  const reason = query(
    `SELECT close_reason FROM marketplace.crm_market_requests WHERE id='${old.id}'`,
  );
  assert.equal(reason, 'expired');
  const open = query(
    `SELECT open FROM marketplace.crm_market_request_sources WHERE request_id='${old.id}'`,
  );
  assert.equal(open, 'f');
  assert.equal((await closeRequest(teams.one, fresh.value.request.id)).status, 200);
});

test('two posters racing for one client: one request, and the other is told why', async () => {
  const record = await client(teams, 'one');
  const results = await Promise.all([
    postRequest(teams.one, record.id),
    postRequest(teams.admin, record.id),
  ]);
  const statuses = results.map((result) => result.status).sort();
  assert.deepEqual(statuses, [201, 409], JSON.stringify(results.map((r) => r.value)));
  const refused = results.find((result) => result.status === 409);
  assert.equal(refused.value.message, 'This client already has an open request.');
  const posted = results.find((result) => result.status === 201);
  const owner = posted === results[0] ? teams.one : teams.admin;
  assert.equal((await closeRequest(owner, posted.value.request.id)).status, 200);
});

test('a request for any bedroom count shows under every bedroom filter', async () => {
  const [any] = await seedRequests(teams, 1, { property_type: 'Plot', bedrooms: 'NULL' });
  const [three] = await seedRequests(teams, 1, { property_type: 'Plot', bedrooms: 3 });
  const seen = await board(teams.two, { propertyType: 'Plot', bedrooms: 2 });
  assert.equal(seen.status, 200, JSON.stringify(seen.value));
  const ids = seen.value.requests.map((row) => row.id);
  assert.ok(ids.includes(any), 'the any-bedrooms request is listed');
  assert.ok(!ids.includes(three), 'a three-bedroom request is not');
});

test('paging never skips requests created within the same millisecond', async () => {
  const seeded = await seedRequests(teams, 21, { property_type: 'Showroom' });
  const list = seeded.map((id) => `'${id}'`).join(',');
  query(
    `UPDATE marketplace.crm_market_requests SET created_at=timestamptz ` +
      `'2026-10-24 08:00:00.123+00' + (random() * 900)::int * interval '1 microsecond' ` +
      `WHERE id IN (${list})`,
  );
  const first = await board(teams.two, { propertyType: 'Showroom' });
  assert.equal(first.status, 200, JSON.stringify(first.value));
  assert.equal(first.value.requests.length, 20);
  const second = await board(teams.two, {
    propertyType: 'Showroom',
    cursor: first.value.nextCursor,
  });
  assert.equal(second.status, 200, JSON.stringify(second.value));
  const ids = [...first.value.requests, ...second.value.requests].map((row) => row.id);
  assert.deepEqual(new Set(ids), new Set(seeded));
});
