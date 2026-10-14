import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { teamPath } from './team-helpers.mjs';
import { FINANCE } from './permission-helpers.mjs';
import { FINANCE_MESSAGES as M, financeTeams } from './finance-helpers.mjs';

let teams;
before(async () => {
  teams = await financeTeams('fin-invite');
});

const storedFinance = (id) =>
  JSON.parse(query(`SELECT actions->'finance' FROM crm_users WHERE id='${id}'`));
const send = (session, body) =>
  session.request(`${teamPath(session)}/invitations`, { method: 'POST', body });
const inviteBody = (suffix, finance, positions = ['property-agent']) => ({
  name: `Synthetic ${suffix}`,
  email: `${suffix}@team-fixture.test`,
  phone: '+971501234567',
  positions,
  actions: { ...teams.agent.user.actions, finance },
});

test('invitations decode finance strictly and never grant approve or teamView', async () => {
  const shaped = { create: true, edit: false, assign: true };
  const created = await send(teams.admin, inviteBody('fin-invite-shape', shaped));
  assert.equal(created.status, 201, JSON.stringify(created.value));
  const want = { ...shaped, approve: false, teamView: false };
  assert.deepEqual(storedFinance(created.value.member.id), want);
  assert.deepEqual(created.value.member.actions.finance, want);
  for (const [finance, message] of [
    [{ ...shaped, teamView: true }, M.needsTeam],
    [{ ...shaped, approve: true, teamView: true }, M.needsTeam],
    [{ ...shaped, approve: true }, M.needsTeam],
    [{}, 'Provide valid invitation details.'],
    [{ ...shaped, payouts: false }, 'Provide valid invitation details.'],
    [{ ...shaped, edit: 'no' }, 'Provide valid invitation details.'],
  ]) {
    const result = await send(teams.admin, inviteBody('fin-invite-refused', finance));
    assert.equal(result.status, 400, JSON.stringify(finance));
    assert.equal(result.value.message, message, JSON.stringify(finance));
  }
  const off = await send(
    teams.admin,
    inviteBody('fin-invite-off', { create: true, edit: true, assign: true }, ['receptionist']),
  );
  assert.equal(off.status, 201);
  assert.deepEqual(storedFinance(off.value.member.id), FINANCE.none, 'module off clears flags');
});

test('invitations without a finance key take the position preset', async () => {
  const { finance, ...legacy } = teams.agent.user.actions;
  assert.ok(finance);
  const body = { ...inviteBody('fin-invite-legacy', null), actions: legacy };
  const created = await send(teams.admin, body);
  assert.equal(created.status, 201, JSON.stringify(created.value));
  assert.deepEqual(storedFinance(created.value.member.id), FINANCE.preset);
});
