import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { leave } from './marketplace-helpers.mjs';
import {
  board,
  client,
  closeRequest,
  mine,
  postHeld,
  renewRequest,
  requestTeams,
} from './marketplace-request-helpers.mjs';

// Renewing, closing, leaving and a client who moves on (docs/broker-marketplace.md §3, packet MK2).
let teams;
before(async () => {
  teams = await requestTeams('market-life');
});

const row = (session, id) =>
  mine(session).then((r) => r.value.requests.find((one) => one.id === id));
const reason = (id) =>
  query(`SELECT close_reason FROM marketplace.crm_market_requests WHERE id='${id}'`).trim();

test('an expired request can be renewed, and a closed one cannot', async () => {
  const record = await client(teams, 'two');
  const posted = await postHeld(teams.two, record.id);
  query(
    `UPDATE marketplace.crm_market_requests SET expires_at=now()-interval '1 day' ` +
      `WHERE id='${posted.id}'`,
  );
  const expired = await row(teams.two, posted.id);
  assert.equal(expired.state, 'expired');
  assert.equal(expired.canRenew, true);
  const renewed = await renewRequest(teams.two, posted.id);
  assert.equal(renewed.status, 200, JSON.stringify(renewed.value));
  assert.equal(renewed.value.request.state, 'open');
  const days = (Date.parse(renewed.value.request.expiresAt) - Date.now()) / 86_400_000;
  assert.ok(days > 29 && days <= 30.1, String(days));
  const closed = await closeRequest(teams.two, posted.id);
  assert.equal(closed.status, 200, JSON.stringify(closed.value));
  assert.equal(reason(posted.id), 'done');
  const refused = await renewRequest(teams.two, posted.id);
  assert.equal(refused.status, 409, JSON.stringify(refused.value));
});

test('a request expired more than thirty days ago cannot be renewed', async () => {
  const posted = await postHeld(teams.two, (await client(teams, 'two')).id);
  query(
    `UPDATE marketplace.crm_market_requests SET expires_at=now()-interval '40 days' ` +
      `WHERE id='${posted.id}'`,
  );
  const stale = await row(teams.two, posted.id);
  assert.equal(stale.state, 'expired');
  assert.equal(stale.canRenew, false);
  const refused = await renewRequest(teams.two, posted.id);
  assert.equal(refused.status, 409, JSON.stringify(refused.value));
});

test('leaving the marketplace closes the open requests with the reason left', async () => {
  const posted = await postHeld(teams.one, (await client(teams, 'one')).id);
  const left = await leave(teams.one);
  assert.equal(left.status, 200, JSON.stringify(left.value));
  assert.equal(reason(posted.id), 'left');
});

test('a client who moves on leaves the board at once and closes on the next read', async () => {
  const record = await client(teams, 'two');
  const posted = await postHeld(teams.two, record.id);
  assert.equal(
    (await board(teams.agent)).value.requests.some((r) => r.id === posted.id),
    true,
  );
  query(`UPDATE crm_records SET assignee_id='${teams.admin.user.id}' WHERE id='${record.id}'`);
  const hidden = await board(teams.agent);
  assert.equal(
    hidden.value.requests.some((r) => r.id === posted.id),
    false,
  );
  const closed = await row(teams.two, posted.id);
  assert.equal(closed.state, 'closed');
  assert.equal(reason(posted.id), 'client_changed');
});
