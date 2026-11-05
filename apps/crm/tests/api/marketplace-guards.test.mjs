import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import {
  apply,
  approve,
  market,
  marketTeams,
  ready,
  status,
  switchCompany,
} from './marketplace-helpers.mjs';

// One gate on every route (review amendment 1) and insert-only evidence (§14 amendment 4).
let teams;
before(async () => {
  teams = await marketTeams('market-guards');
  await ready(teams.admin);
  await apply(teams.admin);
  await approve(teams.owner, teams.admin);
});

const ask = async (session, workspace, tail, options = {}) => {
  const result = await market(session, tail, options, workspace);
  assert.equal(result.status, 404, JSON.stringify(result.value));
  return JSON.stringify(result.value);
};

test('outsiders get one identical not-found on every member route', async () => {
  const bodies = new Set();
  const outsiders = [
    [teams.owner, teams.owner.user.workspaceId],
    [teams.other, teams.admin.user.workspaceId],
    [teams.admin, 'no-such-company'],
  ];
  for (const [session, workspace] of outsiders) {
    bodies.add(await ask(session, workspace, '/status'));
    bodies.add(await ask(session, workspace, '/application', { method: 'POST' }));
    bodies.add(
      await ask(session, workspace, '/company', {
        method: 'PUT',
        body: { enabled: true, expectedVersion: 0 },
      }),
    );
  }
  assert.equal(bodies.size, 1, [...bodies].join(' | '));
});

test('company members get the same not-found on the platform routes', async () => {
  const row = (await status(teams.admin)).company;
  assert.ok(row);
  const list = await teams.admin.request(
    '/workspaces/super-admin-workspace/marketplace/applications?state=all',
  );
  assert.equal(list.status, 404, JSON.stringify(list.value));
  const decision = await teams.admin.request(
    `/workspaces/${teams.admin.user.workspaceId}/marketplace/decision`,
    {
      method: 'POST',
      body: { applicationId: randomUUID(), decision: 'revoked', reason: 'No.' },
    },
  );
  assert.equal(decision.status, 404, JSON.stringify(decision.value));
  assert.equal(JSON.stringify(list.value), JSON.stringify(decision.value));
});

test('every write needs the anti-forgery token', async () => {
  const apply = await market(teams.other, '/application', { method: 'POST', csrf: undefined });
  assert.equal(apply.status, 403, JSON.stringify(apply.value));
  const switched = await market(teams.admin, '/company', {
    method: 'PUT',
    body: { enabled: true, expectedVersion: 0 },
    csrf: undefined,
  });
  assert.equal(switched.status, 403, JSON.stringify(switched.value));
});

test('a stale switch version is refused and the history keeps both changes', async () => {
  const first = await switchCompany(teams.admin, false, 0);
  assert.equal(first.status, 200, JSON.stringify(first.value));
  assert.deepEqual(first.value.company, { enabled: false, version: 1 });
  assert.equal((await status(teams.admin)).company.enabled, false);
  const stale = await switchCompany(teams.admin, true, 0);
  assert.equal(stale.status, 409, JSON.stringify(stale.value));
  const back = await switchCompany(teams.admin, true, 1);
  assert.equal(back.status, 200, JSON.stringify(back.value));
  assert.deepEqual(back.value.company, { enabled: true, version: 2 });
  const history = query(
    `SELECT count(*)||'|'||min(enabled::text)||'|'||max(enabled::text) FROM marketplace.crm_market_company_events WHERE workspace_id='${teams.admin.user.workspaceId}'`,
  );
  assert.equal(history, '2|false|true');
});

test('marketplace evidence cannot be changed or deleted directly', async () => {
  const tables = [
    'crm_market_applications',
    'crm_market_decisions',
    'crm_market_company_events',
    'crm_market_events',
  ];
  for (const table of tables) {
    assert.throws(
      () => query(`UPDATE marketplace.${table} SET workspace_id=workspace_id`),
      /insert-only/,
      table,
    );
    assert.throws(() => query(`DELETE FROM marketplace.${table}`), /insert-only/, table);
  }
});
