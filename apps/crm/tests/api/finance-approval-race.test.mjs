import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import {
  approvalTeams,
  decide,
  edit,
  entryPath,
  paymentBody,
} from './finance-approval-helpers.mjs';
import { paymentFields, submit } from './finance-approval-helpers.mjs';

let teams;
before(async () => {
  teams = await approvalTeams('fin-appr-race');
});

const P = 'payments';
const statuses = (results) => results.map((result) => result.status).sort();
const pay = (amountFils) =>
  submit(teams.agent, teams.admin, P, paymentBody(teams.deal.dealId, { amountFils }));

test('two approvers deciding at once: one 200, one 409', async () => {
  const { admin, approver, approver2 } = teams;
  for (const verdicts of [
    ['approve', 'approve'],
    ['approve', 'reject'],
  ]) {
    const payment = await pay(1);
    const results = await Promise.all([
      decide(approver, admin, P, payment, verdicts[0]),
      decide(
        approver2,
        admin,
        P,
        payment,
        verdicts[1],
        verdicts[1] === 'reject' ? { reason: 'Race' } : {},
      ),
    ]);
    assert.deepEqual(statuses(results), [200, 409], JSON.stringify(results.map((r) => r.value)));
    const decisions = query(`SELECT count(*) FROM crm_finance_events WHERE entity_id='${payment.id}'
      AND action IN ('approved','rejected')`);
    assert.equal(decisions, '1');
  }
});

test('approval racing an edit: the loser gets a version conflict', async () => {
  const { admin, agent, approver } = teams;
  const payment = await pay(2);
  const results = await Promise.all([
    decide(approver, admin, P, payment, 'approve'),
    edit(agent, admin, P, payment, paymentFields(payment, { amountFils: 3 })),
  ]);
  assert.deepEqual(statuses(results), [200, 409]);
  assert.equal(results.find((r) => r.status === 409).value.code, 'version_conflict');
});

test('parallel approvals on one deal never exceed its net (M-F4)', async () => {
  const { admin, approver, approver2 } = teams;
  const remaining = 4_900_000 - Number(query(`SELECT crm_deal_approved_fils('${teams.deal.id}')`));
  const first = await pay(remaining - 10);
  const second = await pay(remaining - 10);
  const results = await Promise.all([
    decide(approver, admin, P, first, 'approve'),
    decide(approver2, admin, P, second, 'approve'),
  ]);
  assert.deepEqual(statuses(results), [200, 409]);
  const over = results.find((result) => result.status === 409).value;
  assert.equal(over.message, "Approving this payment would exceed the deal's fee.");
  const total = Number(query(`SELECT crm_deal_approved_fils('${teams.deal.id}')`));
  assert.ok(total <= 4_900_000, String(total));
});

test('20 parallel submissions receive unique payment and expense IDs', async () => {
  const { admin, agent } = teams;
  const create = (kind, body) => agent.request(entryPath(admin, kind), { method: 'POST', body });
  const payments = await Promise.all(
    Array.from({ length: 20 }, () =>
      create(P, { payment: paymentBody(teams.deal.dealId, { amountFils: 1 }) }),
    ),
  );
  const expenses = await Promise.all(
    Array.from({ length: 20 }, () =>
      create('expenses', {
        expense: { datePaid: payments[0].value.payment.receiptDate, amountFils: 1 },
      }),
    ),
  );
  for (const [results, key, id] of [
    [payments, 'payment', 'paymentId'],
    [expenses, 'expense', 'expenseId'],
  ]) {
    assert.deepEqual([...new Set(statuses(results))], [201]);
    assert.equal(new Set(results.map((result) => result.value[key][id])).size, 20);
  }
});
