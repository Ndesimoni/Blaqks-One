import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { market, switchCompany } from './marketplace-helpers.mjs';
import { client, postHeld, requestTeams } from './marketplace-request-helpers.mjs';
import { query } from './helpers.mjs';

let teams;
let request;
let room;
before(async () => {
  teams = await requestTeams('market-conversations');
  request = await postHeld(teams.one, (await client(teams, 'one')).id);
});
const start = (session, body = 'Could we discuss the preferred move-in month?') =>
  market(session, `/requests/${request.id}/conversations`, { method: 'POST', body: { body } });
const messages = (session, id) => market(session, `/conversations/${id}/messages`);

test('a no-match broker starts a private request conversation without arbitrary recipients', async () => {
  const result = await start(teams.agent);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  room = result.value.conversationId;
  const received = await messages(teams.one, room);
  assert.equal(received.status, 200, JSON.stringify(received.value));
  assert.equal(received.value.messages[0].body, 'Could we discuss the preferred move-in month?');
  assert.equal(
    (await messages(teams.admin, room)).status,
    404,
    'poster company Admin has no DM access',
  );
  assert.equal(
    (await messages(teams.other, room)).status,
    404,
    'broker company Admin has no DM access',
  );
  assert.equal((await messages(teams.colleague, room)).status, 404);
  assert.equal((await start(teams.two)).status, 404, 'same-company initiation is refused');
});

test('messages reject recognizable contact details and require a live marketplace', async () => {
  assert.equal((await start(teams.agent, 'Contact me at agent@example.test')).status, 400);
  assert.equal((await start(teams.agent, ' ')).status, 400);
  assert.equal((await start(teams.agent, 'x'.repeat(2001))).status, 400);
  assert.equal((await switchCompany(teams.other, false, 0)).status, 200);
  assert.equal((await messages(teams.one, room)).status, 404);
  assert.equal((await switchCompany(teams.other, true, 1)).status, 200);
  assert.equal((await messages(teams.one, room)).status, 200);
});

test('paused requests block new conversations while preserving existing participant replies', async () => {
  query(`UPDATE marketplace.crm_market_requests SET paused_at=now() WHERE id='${request.id}'`);
  assert.equal((await start(teams.colleague)).status, 409);
  const sent = await market(teams.agent, `/conversations/${room}/messages`, {
    method: 'POST',
    body: { body: 'Another question' },
  });
  assert.equal(sent.status, 200, JSON.stringify(sent.value));
  assert.equal((await messages(teams.one, room)).status, 200);
  const notice = await market(teams.colleague, '/notifications');
  assert.equal(notice.status, 200);
  assert.deepEqual(notice.value.notifications, []);
});
