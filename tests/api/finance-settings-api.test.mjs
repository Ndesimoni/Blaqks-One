import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query, request } from './helpers.mjs';
import { FINANCE_MESSAGES as M, events, failure, financePath } from './finance-helpers.mjs';
import { financeTeams, refused, settingsBody } from './finance-helpers.mjs';

let teams;
before(async () => {
  teams = await financeTeams('fin-set');
});

const put = (session, body, workspace) =>
  session.request(financePath(teams.admin, '/settings', workspace), { method: 'PUT', body });
const overview = (session, suffix = '') => session.request(financePath(teams.admin, suffix));
const INVALID = 'Provide valid finance settings.';

test('GET /finance is shaped per caller and needs the finance module', async () => {
  const { owner, admin, other, agent, desk } = teams;
  const team = await overview(admin);
  assert.equal(team.status, 200, JSON.stringify(team.value));
  assert.equal(team.value.scope, 'team');
  assert.equal(team.value.settings, null);
  assert.deepEqual(team.value.teamTotals.byAgent, []);
  const own = await overview(agent);
  assert.equal(own.status, 200);
  assert.deepEqual(Object.keys(own.value).sort(), [
    ...['deals', 'expenses', 'handovers', 'myAgreements', 'payments', 'references'],
    ...['scope', 'settings', 'statement'],
  ]);
  assert.equal(own.value.scope, 'own');
  assert.equal((await overview(owner)).value.scope, 'team', 'Super Admin views by role');
  refused(await overview(desk), 403, M.denied, 'forbidden', 'no finance module');
  refused(await overview(other), 403, M.denied, 'forbidden', 'another team');
  refused(await overview(agent, `?agent=${agent.user.id}`), 403, M.denied, 'forbidden');
  assert.equal((await overview(admin, `?agent=${agent.user.id}`)).status, 200);
  assert.equal((await overview(admin, '?agent=nope')).status, 400);
  assert.equal((await overview(admin, '?agentId=x')).status, 400);
});

test('settings writes are Admin-only and checked before the body', async () => {
  const { owner, other, agent, desk, admin } = teams;
  const bad = { surprise: true };
  refused(await put(agent, bad), 403, M.manage, 'forbidden', 'agent');
  refused(await put(owner, settingsBody()), 403, M.manage, 'forbidden', 'Super Admin');
  refused(await put(desk, bad), 403, M.denied, 'forbidden', 'no module');
  refused(await put(other, settingsBody()), 403, M.denied, 'forbidden', 'other team');
  const path = financePath(admin, '/settings');
  const noCsrf = await request(path, { method: 'PUT', cookie: admin.cookie, body: settingsBody() });
  assert.equal(noCsrf.status, 403);
  for (const [changes, message] of [
    [{ agentShareBp: 60.5 }, M.percent],
    [{ agentShareBp: '6000' }, M.percent],
    [{ agentShareBp: 10001 }, M.percent],
    [{ maxReferralShareBp: -1 }, M.percent],
    [{ trn: '12345' }, M.trn],
    [{ trn: 100123456700003 }, M.trn],
    [{ secondAgentSource: 'agent' }, 'Choose a valid second-agent split source.'],
    [{ version: 0 }, INVALID],
    [{ vatRegistered: 'yes' }, INVALID],
    [{ extra: 1 }, INVALID],
  ]) {
    refused(await put(admin, settingsBody(changes)), 400, message, 'invalid_request');
  }
  const { trn, ...missing } = settingsBody();
  assert.ok(trn);
  refused(await put(admin, missing), 400, INVALID, 'invalid_request', 'missing key');
});

test('settings save with versions, write history and shape the own view', async () => {
  const { admin, agent, owner } = teams;
  const first = await put(admin, settingsBody());
  assert.equal(first.status, 200, JSON.stringify(first.value));
  const want = { ...settingsBody(), version: 1, vatRateBp: 500 };
  assert.deepEqual(first.value.settings, want);
  const stale = await put(admin, settingsBody());
  refused(stale, 409, 'Finance settings changed. Reload before saving.', 'version_conflict');
  const changes = { version: 1, agentShareBp: 6000, secondAgentSource: 'company', trn: null };
  const second = await put(admin, settingsBody(changes));
  assert.equal(second.status, 200);
  assert.equal(second.value.settings.version, 2);
  assert.equal((await put(admin, settingsBody(changes))).status, 409, 'version 1 is stale');
  const same = await put(admin, settingsBody({ ...changes, version: 2 }));
  assert.equal(same.value.settings.version, 2, 'an unchanged save keeps the version');
  const id = query(
    `SELECT id FROM crm_finance_settings WHERE workspace_id='${admin.user.workspaceId}'`,
  );
  const history = events(id);
  assert.deepEqual(
    history.map((event) => event.action),
    ['created', 'updated'],
  );
  assert.deepEqual(history[0].changes, {
    agentShareBp: [null, 5000],
    secondAgentSource: [null, 'first_agent'],
    maxReferralShareBp: [null, 2000],
    vatRegistered: [null, true],
    trn: 'changed',
  });
  assert.deepEqual(history[1].changes, {
    agentShareBp: [5000, 6000],
    secondAgentSource: ['first_agent', 'company'],
    trn: 'changed',
  });
  assert.ok(history.every((event) => event.actor === admin.user.id && event.source === 'app'));
  assert.equal(
    query(`SELECT count(*) FROM crm_finance_events WHERE changes::text ~ '1001234'`),
    '0',
  );
  const own = await overview(agent);
  assert.deepEqual(own.value.settings, { vatRegistered: true, vatRateBp: 500, trn: null });
  const team = await overview(owner);
  assert.equal(team.value.settings.agentShareBp, 6000);
  assert.match(
    failure(`UPDATE crm_finance_settings SET vat_rate_bp=600 WHERE id='${id}'`),
    /crm_finance_settings_vat_rate_bp_check/,
  );
});
