import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { market, switchCompany } from './marketplace-helpers.mjs';
import { client, postHeld, requestTeams, seedRequests } from './marketplace-request-helpers.mjs';

let teams;
let request;
let room;
const mine = (session, offset, workspace) =>
  market(
    session,
    `/conversations${offset === undefined ? '' : `?offset=${offset}`}`,
    {},
    workspace,
  );
const messages = (session, options = {}) =>
  market(session, `/conversations/${room}/messages`, options);

before(async () => {
  teams = await requestTeams('market-chats');
  request = await postHeld(teams.one, (await client(teams, 'one')).id);
  const started = await market(teams.agent, `/requests/${request.id}/conversations`, {
    method: 'POST',
    body: { body: 'Synthetic question about the preferred areas.' },
  });
  assert.equal(started.status, 200, JSON.stringify(started.value));
  room = started.value.conversationId;
});

test('only participants list the redacted broker chat projection', async () => {
  const broker = await mine(teams.agent);
  assert.equal(broker.status, 200, JSON.stringify(broker.value));
  const row = broker.value.conversations.find((entry) => entry.id === room);
  assert.deepEqual(Object.keys(row).sort(), [
    'canReply',
    'closed',
    'id',
    'lastMessage',
    'mine',
    'participantId',
    'participantName',
    'request',
    'updatedAt',
  ]);
  assert.equal(row.participantName, teams.one.user.name);
  assert.equal(row.mine, false);
  assert.equal(row.closed, false);
  assert.equal(row.canReply, true);
  assert.equal(row.request.id, request.id);
  assert.equal(row.lastMessage.body, 'Synthetic question about the preferred areas.');
  assert.doesNotMatch(JSON.stringify(row), /budget_min|budgetMin|client|email|phone/i);
  const poster = await mine(teams.one);
  const own = poster.value.conversations.find((entry) => entry.id === room);
  assert.equal(own.participantName, teams.agent.user.name);
  assert.equal(own.mine, true);
  for (const session of [teams.admin, teams.other, teams.colleague]) {
    const list = await mine(session);
    assert.equal(list.status, 200, JSON.stringify(list.value));
    assert.equal(
      list.value.conversations.some((entry) => entry.id === room),
      false,
    );
  }
  assert.equal((await mine(teams.owner, undefined, teams.one.user.workspaceId)).status, 404);
  assert.equal((await mine(teams.one, undefined, teams.other.user.workspaceId)).status, 404);
});

test('paused chats remain replyable; ended requests retain read-only history', async () => {
  query(`UPDATE marketplace.crm_market_requests SET paused_at=now() WHERE id='${request.id}'`);
  let row = (await mine(teams.one)).value.conversations.find((entry) => entry.id === room);
  assert.equal(row.closed, false);
  assert.equal(row.canReply, true);
  const long = 'x'.repeat(160);
  const sent = await messages(teams.one, { method: 'POST', body: { body: long } });
  assert.equal(sent.status, 200, JSON.stringify(sent.value));
  row = (await mine(teams.agent)).value.conversations.find((entry) => entry.id === room);
  assert.equal(row.lastMessage.body, 'x'.repeat(140));
  query(
    `UPDATE marketplace.crm_market_requests SET paused_at=NULL,closed_at=now(),close_reason='done' WHERE id='${request.id}'`,
  );
  row = (await mine(teams.one)).value.conversations.find((entry) => entry.id === room);
  assert.equal(row.closed, true);
  assert.equal(row.canReply, false);
  assert.equal((await messages(teams.one)).status, 200);
  assert.equal(
    (await messages(teams.one, { method: 'POST', body: { body: 'Too late.' } })).status,
    409,
  );
  query(
    `UPDATE marketplace.crm_market_requests SET closed_at=NULL,close_reason=NULL,expires_at=now()-interval '1 day' WHERE id='${request.id}'`,
  );
  row = (await mine(teams.one)).value.conversations.find((entry) => entry.id === room);
  assert.equal(row.closed, true);
  assert.equal(row.canReply, false);
  query(
    `UPDATE marketplace.crm_market_requests SET expires_at=now()+interval '10 days' WHERE id='${request.id}'`,
  );
});

test('a disabled participant company disappears without exposing stale rows', async () => {
  const off = await switchCompany(teams.other, false, 0);
  assert.equal(off.status, 200, JSON.stringify(off.value));
  const hidden = await mine(teams.one);
  assert.equal(
    hidden.value.conversations.some((entry) => entry.id === room),
    false,
  );
  assert.equal((await mine(teams.agent)).status, 409);
  const on = await switchCompany(teams.other, true, 1);
  assert.equal(on.status, 200, JSON.stringify(on.value));
  assert.equal(
    (await mine(teams.one)).value.conversations.some((entry) => entry.id === room),
    true,
  );
});

test('chat history pages in stable bounded batches', async () => {
  const ids = await seedRequests(teams, 55);
  for (let index = 0; index < ids.length; index += 1) {
    query(
      `INSERT INTO marketplace.crm_market_conversations ` +
        `(id,request_id,broker_id,broker_workspace,updated_at) VALUES ` +
        `('${randomUUID()}','${ids[index]}','${teams.one.user.id}',` +
        `'${teams.one.user.workspaceId}',now()-interval '${index + 1} minutes')`,
    );
  }
  const first = await mine(teams.one, 0);
  const second = await mine(teams.one, first.value.nextOffset);
  assert.equal(first.status, 200, JSON.stringify(first.value));
  assert.equal(first.value.conversations.length, 50);
  assert.equal(first.value.nextOffset, 50);
  assert.equal(second.value.conversations.length, 6);
  assert.equal(second.value.nextOffset, null);
  const all = [...first.value.conversations, ...second.value.conversations];
  assert.equal(new Set(all.map((entry) => entry.id)).size, 56);
  assert.equal((await mine(teams.one, -1)).status, 400);
  assert.equal((await mine(teams.one, 'not-a-page')).status, 400);
});
