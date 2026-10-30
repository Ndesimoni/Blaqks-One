import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { activate, findMember, invite } from './team-helpers.mjs';
import { FINANCE, grant } from './permission-helpers.mjs';
import { FINANCE_MESSAGES as M, day, events, failure, financePath } from './finance-helpers.mjs';
import { financeTeams, refused } from './finance-helpers.mjs';

let teams, viewer, two, a1, a2;
before(async () => {
  teams = await financeTeams('fin-agree');
  two = await activate(await invite(teams.admin, 'fin-agree-two', { positions: ['accountant'] }));
  const staff = await activate(
    await invite(teams.admin, 'fin-agree-viewer', { positions: ['accountant'] }),
  );
  const member = await findMember(teams.admin, staff.user.id);
  const actions = { ...member.actions, finance: FINANCE.all };
  viewer = await grant(teams.admin, staff, { recordScope: 'team', actions });
});

const path = (suffix = '') => financePath(teams.admin, `/agreements${suffix}`);
const create = (session, body) => session.request(path(), { method: 'POST', body });
const remove = (session, id) => session.request(path(`/${id}`), { method: 'DELETE' });
const body = (agentId, agentShareBp, effectiveFrom) => ({ agentId, agentShareBp, effectiveFrom });
const INVALID = 'Provide valid agreement details.';

test('agreements are Admin-written, team-read and validated before the lock', async () => {
  const { owner, admin, other, agent, desk } = teams;
  const valid = body(agent.user.id, 6000, day(-200));
  refused(await create(agent, { bad: 1 }), 403, M.manage, 'forbidden', 'agent');
  refused(await create(viewer, valid), 403, M.manage, 'forbidden', 'approver');
  refused(await create(owner, valid), 403, M.manage, 'forbidden', 'Super Admin');
  refused(await create(desk, valid), 403, M.denied, 'forbidden', 'no module');
  refused(await agent.request(path()), 403, M.denied, 'forbidden', 'own view reads');
  assert.equal((await viewer.request(path())).status, 200);
  assert.equal((await owner.request(path())).status, 200);
  const otherStaff = await activate(await invite(other, 'fin-agree-foreign'));
  for (const [value, message] of [
    [body(admin.user.id, 6000, day(-200)), M.notStaff],
    [body(otherStaff.user.id, 6000, day(-200)), M.notStaff],
    [body('not-a-uuid', 6000, day(-200)), M.notStaff],
    [body(agent.user.id, 60.5, day(-200)), M.percent],
    [body(agent.user.id, 6000, '2026-02-30'), 'Enter a valid date (YYYY-MM-DD).'],
    [{ ...valid, effectiveTo: null }, INVALID],
  ]) {
    refused(await create(admin, value), 400, message, 'invalid_request', JSON.stringify(value));
  }
});

test('a new agreement auto-closes the open one; overlaps are refused twice over', async () => {
  const { admin, agent } = teams;
  const first = await create(admin, body(agent.user.id, 6000, day(-200)));
  assert.equal(first.status, 201, JSON.stringify(first.value));
  assert.equal(first.value.closed, null);
  a1 = first.value.agreement;
  assert.deepEqual(a1.agent, { id: agent.user.id, name: agent.user.name });
  const second = await create(admin, body(agent.user.id, 6500, day(-100)));
  assert.equal(second.status, 201);
  a2 = second.value.agreement;
  assert.deepEqual(second.value.closed, { id: a1.id, effectiveTo: day(-100) });
  for (const from of [day(-100), day(-150), day(-300)]) {
    refused(await create(admin, body(agent.user.id, 7000, from)), 409, M.overlap, 'conflict');
  }
  const listed = await admin.request(path(`?agentId=${agent.user.id}`));
  assert.deepEqual(
    listed.value.agreements.map((a) => [a.id, a.effectiveFrom, a.effectiveTo]),
    [
      [a1.id, day(-200), day(-100)],
      [a2.id, day(-100), null],
    ],
  );
  assert.deepEqual(
    events(a1.id).map((e) => [e.action, e.changes]),
    [
      [
        'created',
        {
          agentId: [null, agent.user.id],
          agentShareBp: [null, 6000],
          effectiveFrom: [null, day(-200)],
        },
      ],
      ['closed', { effectiveTo: [null, day(-100)] }],
    ],
  );
  const ws = admin.user.workspaceId;
  const insert = `INSERT INTO crm_commission_agreements (id,workspace_id,agent_id,agent_share_bp,
    effective_from,created_by) VALUES (gen_random_uuid(),'${ws}','${agent.user.id}',1,
    '${day(-50)}','${admin.user.id}')`;
  assert.match(failure(insert), /crm_agreements_no_overlap/);
  const asAdmin = insert.replace(`'${agent.user.id}'`, `'${admin.user.id}'`);
  assert.match(failure(asAdmin), /not staff of this workspace/);
  const edit = `UPDATE crm_commission_agreements SET agent_share_bp=1 WHERE id='${a2.id}'`;
  assert.match(failure(edit), /Only an agreement end date may change/);
  assert.match(failure(`DELETE FROM crm_commission_agreements WHERE id='${a1.id}'`), /started/);
});

test('own views list only the agreements of the caller', async () => {
  const mine = await teams.agent.request(financePath(teams.admin));
  assert.deepEqual(mine.value.myAgreements, [
    { id: a1.id, agentShareBp: 6000, effectiveFrom: day(-200), effectiveTo: day(-100) },
    { id: a2.id, agentShareBp: 6500, effectiveFrom: day(-100), effectiveTo: null },
  ]);
  const theirs = await two.request(financePath(teams.admin));
  assert.deepEqual(theirs.value.myAgreements, []);
});

test('only future agreements can be deleted, reopening the one each closed', async () => {
  const { admin, agent, other } = teams;
  const later = await create(admin, body(agent.user.id, 7000, day(30)));
  const latest = await create(admin, body(agent.user.id, 7500, day(60)));
  assert.deepEqual(later.value.closed, { id: a2.id, effectiveTo: day(30) });
  assert.deepEqual(latest.value.closed, { id: later.value.agreement.id, effectiveTo: day(60) });
  const dropped = await remove(admin, later.value.agreement.id);
  assert.equal(dropped.status, 200, JSON.stringify(dropped.value));
  assert.deepEqual(dropped.value.reopened, { id: a2.id, effectiveTo: day(60) });
  const last = await remove(admin, latest.value.agreement.id);
  assert.deepEqual(last.value.reopened, { id: a2.id, effectiveTo: null });
  refused(await remove(admin, a2.id), 409, M.started, 'conflict');
  const missing = { message: 'Record not found.', code: 'not_found' };
  for (const id of ['00000000-0000-4000-8000-000000000000', 'nope', latest.value.agreement.id]) {
    refused(await remove(admin, id), 404, missing.message, missing.code, id);
  }
  const foreign = financePath(other, `/agreements/${a2.id}`);
  refused(await other.request(foreign, { method: 'DELETE' }), 404, missing.message, 'not_found');
  refused(await remove(teams.agent, a2.id), 403, M.manage, 'forbidden');
  const actions = events(a2.id).map((e) => e.action);
  assert.deepEqual(actions, ['created', 'closed', 'reopened', 'reopened']);
  assert.deepEqual(events(later.value.agreement.id).at(-1).changes, {
    agentShareBp: [7000, null],
    effectiveFrom: [day(30), null],
    effectiveTo: [day(60), null],
  });
});

test('M-F3: an agreement reaching back over earned deals is refused', async () => {
  // Stub the 0013 check, then restore its real definition (deal suites rely on it).
  const real = query(`SELECT pg_get_functiondef('crm_agreement_applies_to_earned'::regproc)`);
  const fn = (sql) => `CREATE OR REPLACE FUNCTION crm_agreement_applies_to_earned(ws TEXT,
    agent UUID, starts DATE) RETURNS boolean AS $$ ${sql} $$ LANGUAGE sql STABLE`;
  query(fn(`SELECT starts <= '${day(-10)}'::date`));
  try {
    const back = await create(teams.admin, body(two.user.id, 5000, day(-20)));
    refused(back, 409, M.earned, 'conflict');
    const ahead = await create(teams.admin, body(two.user.id, 5000, day(-5)));
    assert.equal(ahead.status, 201, JSON.stringify(ahead.value));
  } finally {
    query(real);
  }
});
