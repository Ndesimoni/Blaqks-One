import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { overview, sortedKeys } from './finance-deals-helpers.mjs';
import {
  approvalTeams,
  decided,
  expenseBody,
  paymentBody,
  submit,
} from './finance-approval-helpers.mjs';

const SHARED = ['allowed', 'amountFils', 'decidedAt', 'decidedBy', 'id', 'notes', 'reason'];
const PAYMENT = [...SHARED, 'dealId', 'paymentId', 'receiptDate', 'reference', 'status']
  .concat(['submittedBy', 'totalFils', 'vatFils', 'version'])
  .sort();
const EXPENSE = [...SHARED, 'campaignReference', 'category', 'datePaid', 'expenseId']
  .concat(['incurredBy', 'propertyId', 'receiptUrl', 'status', 'submittedBy', 'supplier'])
  .concat(['version'])
  .sort();

let teams, approved, rejected, waiting, mine, theirs, company;
before(async () => {
  teams = await approvalTeams('fin-appr-view');
  const { admin, agent, second, approver } = teams;
  const pay = (amountFils) =>
    submit(agent, admin, 'payments', paymentBody(teams.deal.dealId, { amountFils }));
  approved = await decided(approver, admin, 'payments', await pay(1_000_000), 'approve');
  rejected = await decided(approver, admin, 'payments', await pay(5), 'reject', { reason: 'Typo' });
  waiting = await pay(7);
  mine = await decided(
    approver,
    admin,
    'expenses',
    await submit(agent, admin, 'expenses', expenseBody()),
    'approve',
  );
  theirs = await submit(second, admin, 'expenses', expenseBody({ amountFils: 90_000 }));
  company = await submit(admin, admin, 'expenses', expenseBody({ amountFils: 300_000 }));
  company = await decided(approver, admin, 'expenses', company, 'approve');
});

test('the own view lists own rows with exact keys and never names other approvers', async () => {
  const view = await overview(teams.agent, teams.admin);
  assert.deepEqual(
    view.payments.map((row) => row.id),
    [approved.id, rejected.id, waiting.id],
  );
  for (const row of view.payments) assert.deepEqual(sortedKeys(row), PAYMENT);
  assert.deepEqual(
    view.expenses.map((row) => row.id),
    [mine.id],
  );
  assert.deepEqual(sortedKeys(view.expenses[0]), EXPENSE);
  const [ok, no] = view.payments;
  assert.equal(ok.decidedBy, null, 'approver identity is team-only');
  assert.deepEqual([no.status, no.reason, no.decidedBy], ['rejected', 'Typo', null]);
  assert.deepEqual(ok.allowed, { edit: false, approve: false, reject: false, void: false });
  assert.deepEqual(no.allowed, { edit: true, approve: false, reject: false, void: false });
  assert.ok(!('teamTotals' in view));
  const text = JSON.stringify(view);
  for (const hidden of [teams.approver.user.id, theirs.id, company.id]) {
    assert.ok(!text.includes(hidden), hidden);
  }
  const second = await overview(teams.second, teams.admin);
  assert.deepEqual(second.payments, []);
  assert.deepEqual(
    second.expenses.map((row) => row.id),
    [theirs.id],
  );
});

test('team views list every row with approvers, pending counts and approved expenses', async () => {
  for (const name of ['admin', 'approver', 'viewer', 'owner']) {
    const view = await overview(teams[name], teams.admin);
    assert.equal(view.payments.length, 3, name);
    assert.equal(view.expenses.length, 3, name);
    for (const row of view.payments) assert.deepEqual(sortedKeys(row), PAYMENT);
    for (const row of view.expenses) assert.deepEqual(sortedKeys(row), EXPENSE);
    const ok = view.payments.find((row) => row.id === approved.id);
    assert.deepEqual(ok.decidedBy, { id: teams.approver.user.id, name: teams.approver.user.name });
    assert.equal(view.teamTotals.pendingCount, 2, `${name}: one payment and one expense`);
    assert.equal(view.teamTotals.expensesApprovedFils, 450_000, name);
    assert.equal(view.teamTotals.receivedFils, 1_000_000, name);
  }
  const owner = await overview(teams.owner, teams.admin);
  const allowed = owner.payments.find((row) => row.id === waiting.id).allowed;
  assert.deepEqual(allowed, { edit: false, approve: false, reject: false, void: false });
  const viewer = (await overview(teams.viewer, teams.admin)).payments.find(
    (r) => r.id === waiting.id,
  );
  assert.deepEqual(viewer.allowed, { edit: true, approve: false, reject: false, void: false });
  const admin = (await overview(teams.admin)).payments.find((row) => row.id === approved.id);
  assert.deepEqual(admin.allowed, { edit: true, approve: false, reject: false, void: true });
});

test('the agent filter narrows payments to their deals and expenses to their own', async () => {
  const { admin, agent, second } = teams;
  const forAgent = await overview(admin, admin, `?agent=${agent.user.id}`);
  assert.equal(forAgent.payments.length, 3);
  assert.deepEqual(
    forAgent.expenses.map((row) => row.id),
    [mine.id],
  );
  assert.deepEqual(
    [forAgent.teamTotals.pendingCount, forAgent.teamTotals.expensesApprovedFils],
    [1, 150_000],
  );
  const forSecond = await overview(admin, admin, `?agent=${second.user.id}`);
  assert.deepEqual(forSecond.payments, []);
  assert.deepEqual([forSecond.expenses.length, forSecond.teamTotals.pendingCount], [1, 1]);
});
