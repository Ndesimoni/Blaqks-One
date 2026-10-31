import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import {
  activate,
  findMember,
  invite,
  memberUpdate,
  staffLogin,
  teamPath,
} from './team-helpers.mjs';
import { FINANCE, grant } from './permission-helpers.mjs';
import { FINANCE_MESSAGES as M, failure, financeTeams } from './finance-helpers.mjs';

let teams;
before(async () => {
  teams = await financeTeams('fin-perm');
});

const access = (scope, flags = {}) => ({
  scope,
  ...{ create: false, edit: false, assign: false, approve: false, teamView: false },
  manage: false,
  ...flags,
});
const storedFinance = (id) =>
  JSON.parse(query(`SELECT actions->'finance' FROM crm_users WHERE id='${id}'`));
test('profiles expose financeAccess by role; positions preset own-view finance', async () => {
  const { owner, admin, agent, desk } = teams;
  const all = { create: true, edit: true, assign: true, approve: true, teamView: true };
  assert.deepEqual(admin.user.financeAccess, access('team', { ...all, manage: true }));
  assert.deepEqual(admin.user.actions.finance, FINANCE.all);
  assert.deepEqual(owner.user.financeAccess, access('team', { teamView: true }));
  assert.deepEqual(owner.user.actions.finance, { ...FINANCE.none, teamView: true });
  const own = { create: true, edit: true, assign: true };
  assert.deepEqual(agent.user.financeAccess, access('own', own));
  assert.equal(agent.user.permissions.finance, true, 'Property Agent gains own-view finance');
  assert.deepEqual(desk.user.financeAccess, access('none'));
  assert.deepEqual(storedFinance(desk.user.id), FINANCE.none);
  const roles = (await admin.request(teamPath(admin))).value.roles;
  const preset = (id) => roles.find((role) => role.id === id).actions.finance;
  assert.deepEqual(preset('property-agent'), FINANCE.preset);
  assert.deepEqual(preset('accountant'), FINANCE.preset);
  assert.deepEqual(preset('team-supervisor'), FINANCE.none);
  const listed = await findMember(admin, agent.user.id);
  assert.deepEqual(listed.financeAccess, access('own', own));
});

test('member PATCH gates teamView and approve on scope, with DB guards', async () => {
  const { admin } = teams;
  const staff = await activate(await invite(admin, 'fin-patch', { positions: ['property-agent'] }));
  const patch = async (finance, changes = {}) => {
    const member = await findMember(admin, staff.user.id);
    const actions = finance ? { ...member.actions, finance } : undefined; // omitted: carried
    return admin.request(teamPath(admin, member.id), {
      method: 'PATCH',
      body: memberUpdate(member, { actions, ...changes }),
    });
  };
  const viewer = { ...FINANCE.preset, teamView: true };
  for (const [finance, changes, message] of [
    [viewer, {}, M.needsTeam],
    [{ ...FINANCE.preset, approve: true }, { recordScope: 'team' }, M.approveNeedsView],
    [{ create: true }, {}, 'Provide valid team member changes.'],
    [{ ...FINANCE.preset, extra: true }, {}, 'Provide valid team member changes.'],
  ]) {
    const result = await patch(finance, changes);
    assert.equal(result.status, 400, JSON.stringify(finance));
    assert.equal(result.value.message, message);
  }
  const granted = await patch(FINANCE.all, { recordScope: 'team' });
  assert.equal(granted.status, 200, JSON.stringify(granted.value));
  assert.deepEqual(granted.value.member.financeAccess, access('team', FINANCE.all));
  const approver = await staffLogin(staff.user.email);
  assert.equal(approver.user.financeAccess.approve, true);
  const kept = await patch(null, { name: 'Synthetic approver' });
  assert.equal(kept.status, 200);
  assert.deepEqual(storedFinance(staff.user.id), FINANCE.all, 'omitted finance is carried');
  const narrowed = await patch(null, { recordScope: 'assigned' });
  assert.equal(narrowed.status, 200);
  assert.deepEqual(storedFinance(staff.user.id), FINANCE.preset);
  assert.equal(narrowed.value.member.financeAccess.scope, 'own');
  const sql = (path) => `UPDATE crm_users SET actions=jsonb_set(actions,'{finance,${path}}',
    'true') WHERE id='${staff.user.id}'`;
  assert.match(failure(sql('teamView')), /crm_actions_finance_team/);
  assert.match(failure(sql('approve')), /crm_actions_finance_approve/);
  const member = await findMember(admin, staff.user.id);
  const off = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { permissions: { ...member.permissions, finance: false } }),
  });
  assert.equal(off.status, 200);
  assert.deepEqual(storedFinance(staff.user.id), FINANCE.none);
  assert.equal(off.value.member.financeAccess.scope, 'none');
});

test('finance grant changes log access_changed by name only', async () => {
  const { admin, agent } = teams;
  const activity = () =>
    query(`SELECT string_agg(action, ',' ORDER BY created_at, action) FROM crm_team_activity
      WHERE member_id='${agent.user.id}'`).split(',');
  const count = () => activity().filter((action) => action === 'access_changed').length;
  const start = count();
  const flags = { ...FINANCE.preset, edit: false };
  const member = await findMember(admin, agent.user.id);
  await grant(admin, agent, { actions: { ...member.actions, finance: flags } });
  assert.equal(count(), start + 1);
  const again = await findMember(admin, agent.user.id);
  await grant(admin, agent, { actions: again.actions });
  assert.equal(count(), start + 1, 'unchanged grants log only an update');
  assert.equal(
    query(`SELECT count(*) FROM crm_team_activity a WHERE a::text ~ '(teamView|approve|true)'`),
    '0',
  );
});
