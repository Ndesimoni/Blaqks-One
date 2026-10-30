import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import {
  applications,
  decide,
  leave,
  market,
  marketTeams,
  switchCompany,
} from './marketplace-helpers.mjs';
import {
  board,
  client,
  postHeld,
  renewRequest,
  requestTeams,
} from './marketplace-request-helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';

// Every reason a request leaves the board, the read limits and the shared not-found (packet MK2).
let teams;
let theirs;
before(async () => {
  teams = await requestTeams('market-hide');
  theirs = await postHeld(teams.agent, (await client(teams, 'agent')).id);
});

const lists = async (session, id) =>
  (await board(session)).value.requests.some((row) => row.id === id);

test('an expired request leaves the board', async () => {
  const posted = await postHeld(teams.colleague, (await client(teams, 'colleague')).id);
  assert.equal(await lists(teams.two, posted.id), true);
  query(
    `UPDATE marketplace.crm_market_requests SET expires_at=now()-interval '1 minute' ` +
      `WHERE id='${posted.id}'`,
  );
  assert.equal(await lists(teams.two, posted.id), false);
  const renewed = await renewRequest(teams.colleague, posted.id);
  assert.equal(renewed.status, 200, JSON.stringify(renewed.value));
  assert.equal(await lists(teams.two, posted.id), true);
});

test('the board hides a suspended poster and shows them again once the client is back', async () => {
  const record = await client(teams, 'agent');
  const posted = await postHeld(teams.agent, record.id);
  assert.equal(await lists(teams.two, posted.id), true);
  const status = async (active) => {
    const target = await findMember(teams.other, teams.agent.user.id);
    return teams.other.request(teamPath(teams.other, target.id), {
      method: 'PATCH',
      body: memberUpdate(target, { active }),
    });
  };
  assert.equal((await status(false)).status, 200);
  assert.equal(await lists(teams.two, posted.id), false);
  assert.equal((await status(true)).status, 200);
  // Suspending a member hands their clients over with the rest of their work, so the request
  // only returns once the client does.
  query(`UPDATE crm_records SET assignee_id='${teams.agent.user.id}' WHERE id='${record.id}'`);
  assert.equal(await lists(teams.two, posted.id), true);
});

test('the board hides a poster who left the marketplace', async () => {
  const posted = await postHeld(teams.colleague, (await client(teams, 'colleague')).id);
  assert.equal((await leave(teams.colleague)).status, 200);
  assert.equal(await lists(teams.two, posted.id), false);
});

test('the board hides a company that is switched off or revoked', async () => {
  assert.equal((await switchCompany(teams.other, false, 0)).status, 200);
  assert.equal(await lists(teams.two, theirs.id), false);
  assert.equal((await switchCompany(teams.other, true, 1)).status, 200);
  const queue = await applications(teams.owner, 'all');
  const row = queue.value.applications.find(
    (item) => item.workspaceId === teams.other.user.workspaceId,
  );
  const revoked = await decide(teams.owner, teams.other.user.workspaceId, {
    applicationId: row.id,
    decision: 'revoked',
    reason: 'Synthetic revocation.',
  });
  assert.equal(revoked.status, 200, JSON.stringify(revoked.value));
  assert.equal(await lists(teams.two, theirs.id), false);
});

test('board reads are limited per member and per company', async () => {
  const limit = (key, attempts, seconds) => {
    const hash = createHash('sha256').update(key).digest('hex');
    query(
      `INSERT INTO crm_login_limits (key_hash,attempts,window_seconds) VALUES ('${hash}',${attempts},${seconds}) ` +
        `ON CONFLICT (key_hash) DO UPDATE SET attempts=${attempts},window_started=now(),window_seconds=${seconds}`,
    );
    return hash;
  };
  const member = limit(`market-board:${teams.two.user.id}`, 120, 3600);
  const busy = await board(teams.two);
  assert.equal(busy.status, 429, JSON.stringify(busy.value));
  assert.match(busy.value.message, /You have read/);
  query(`DELETE FROM crm_login_limits WHERE key_hash='${member}'`);
  const company = limit(`market-board-company:${teams.admin.user.workspaceId}`, 600, 3600);
  const blocked = await board(teams.two);
  assert.equal(blocked.status, 429, JSON.stringify(blocked.value));
  assert.match(blocked.value.message, /Your company/);
  query(`DELETE FROM crm_login_limits WHERE key_hash='${company}'`);
});

test('the shared not-found covers every new route', async () => {
  const routes = [
    ['GET', '/requests/mine'],
    ['GET', '/board'],
    ['GET', `/requests/draft?clientId=${theirs.id}`],
    ['POST', '/requests'],
    ['PATCH', `/requests/${theirs.id}`],
    ['POST', `/requests/${theirs.id}/renew`],
    ['POST', `/requests/${theirs.id}/close`],
  ];
  const stranger = await marketTeams('market-stranger');
  const answers = [];
  for (const [method, tail] of routes) {
    const owner = await teams.owner.request(
      `/workspaces/super-admin-workspace/marketplace${tail}`,
      {
        method,
      },
    );
    assert.equal(owner.status, 404, `${method} ${tail}`);
    const foreign = await market(stranger.admin, tail, { method }, teams.other.user.workspaceId);
    assert.equal(foreign.status, 404, `${method} ${tail} as another company`);
    answers.push(JSON.stringify(owner.value));
    answers.push(JSON.stringify(foreign.value));
  }
  assert.equal(new Set(answers).size, 1);
});
