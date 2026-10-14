import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { events, refused } from './finance-helpers.mjs';
import {
  ENTRY,
  approvalTeams,
  decide,
  decided,
  edit,
  submit,
} from './finance-approval-helpers.mjs';
import {
  expenseBody,
  expenseFields,
  paymentBody,
  paymentFields,
} from './finance-approval-helpers.mjs';

let teams;
before(async () => {
  teams = await approvalTeams('fin-appr-rej');
});

const actions = (id) => events(id).map((event) => event.action);

test('rejection needs a reason; editing a rejected payment resubmits it', async () => {
  const { admin, agent, approver, approver2 } = teams;
  const act = (who, entry, verdict, body) => decide(who, admin, 'payments', entry, verdict, body);
  let payment = await submit(agent, admin, 'payments', paymentBody(teams.deal.dealId));
  refused(await act(approver, payment, 'reject'), 400, ENTRY.versionReason, 'invalid_request');
  refused(
    await act(approver, payment, 'reject', { reason: '  ' }),
    400,
    ENTRY.reason,
    'invalid_request',
  );
  refused(await act(admin, payment, 'void', { reason: 'x' }), 409, ENTRY.notApproved, 'conflict');
  payment = await decided(approver, admin, 'payments', payment, 'reject', {
    reason: 'Wrong amount',
  });
  assert.deepEqual([payment.status, payment.reason], ['rejected', 'Wrong amount']);
  refused(await act(approver2, payment, 'approve'), 409, ENTRY.decided, 'conflict');
  const result = await edit(agent, admin, 'payments', payment, paymentFields(payment));
  assert.equal(result.status, 200, JSON.stringify(result.value));
  payment = result.value.payment;
  const decision = [payment.status, payment.decidedBy, payment.decidedAt, payment.reason];
  assert.deepEqual(decision, ['pending', null, null, null]);
  assert.deepEqual(actions(payment.id), ['submitted', 'rejected', 'resubmitted']);
  const [, rejected, resubmitted] = events(payment.id);
  assert.deepEqual([rejected.reason, rejected.actor], ['Wrong amount', approver.user.id]);
  assert.deepEqual(resubmitted.changes, { status: ['rejected', 'pending'] });
  assert.equal(resubmitted.actor, agent.user.id);
  payment = await decided(approver2, admin, 'payments', payment, 'approve');
  assert.equal(payment.status, 'approved');
});

test('expenses follow the same states and never store receipt links in history', async () => {
  const { admin, agent, approver } = teams;
  const put = (who, entry, changes, extra) =>
    edit(who, admin, 'expenses', entry, expenseFields(entry, changes), extra);
  const receiptUrl = 'https://files.example.test/receipts/synthetic-1.pdf';
  let expense = await submit(agent, admin, 'expenses', expenseBody({ receiptUrl }));
  assert.match(expense.expenseId, /^EX-\d{3,}$/);
  assert.deepEqual(expense.incurredBy, { id: agent.user.id, name: agent.user.name });
  assert.equal(expense.receiptUrl, receiptUrl);
  const reject = { reason: 'No VAT receipt' };
  expense = await decided(approver, admin, 'expenses', expense, 'reject', reject);
  let result = await put(agent, expense, { amountFils: 140_000 });
  assert.equal(result.status, 200, JSON.stringify(result.value));
  expense = await decided(approver, admin, 'expenses', result.value.expense, 'approve');
  refused(await put(agent, expense, {}), 403, ENTRY.locked, 'forbidden');
  result = await put(admin, expense, { supplier: 'Synthetic Signs' }, { reason: 'Supplier fixed' });
  assert.equal(result.status, 200, JSON.stringify(result.value));
  const refunded = { reason: 'Refunded' };
  expense = await decided(admin, admin, 'expenses', result.value.expense, 'void', refunded);
  assert.equal(expense.status, 'void');
  assert.deepEqual(actions(expense.id), [
    ...['submitted', 'rejected', 'resubmitted', 'approved', 'updated', 'voided'],
  ]);
  const history = JSON.stringify(events(expense.id));
  assert.ok(!history.includes('files.example.test') && !history.includes('Synthetic Signs'));
  assert.equal(events(expense.id)[0].changes.receiptUrl, 'changed');
  const leaked = query(`SELECT count(*) FROM crm_finance_events WHERE changes::text ~ 'https:'
    OR reason ~ 'https:'`);
  assert.equal(leaked, '0', 'receipt links never enter finance history (L-F5)');
});

test('expense owners: staff record for themselves; the Admin names an active finance member', async () => {
  const { admin, agent, desk, other } = teams;
  const create = (who, body) =>
    who.request(`/workspaces/${admin.user.workspaceId}/finance/expenses`, {
      method: 'POST',
      body: { expense: body },
    });
  const named = expenseBody({ incurredBy: agent.user.id });
  refused(await create(agent, named), 400, ENTRY.forYourself, 'invalid_request');
  const onBehalf = await create(admin, named);
  assert.equal(onBehalf.status, 201, JSON.stringify(onBehalf.value));
  assert.deepEqual(onBehalf.value.expense.incurredBy.id, agent.user.id);
  assert.equal(onBehalf.value.expense.submittedBy.id, admin.user.id);
  const company = await create(admin, expenseBody());
  assert.equal(company.value.expense.incurredBy.id, admin.user.id);
  for (const outsider of [desk.user.id, other.user.id]) {
    const refusedOwner = await create(admin, expenseBody({ incurredBy: outsider }));
    refused(refusedOwner, 400, ENTRY.ineligible, 'invalid_request');
  }
  const insecure = expenseBody({ receiptUrl: 'http://files.example.test/r.pdf' });
  refused(await create(agent, insecure), 400, ENTRY.receipt, 'invalid_request');
  refused(
    await create(agent, expenseBody({ datePaid: '2099-12-31' })),
    400,
    ENTRY.future,
    'invalid_request',
  );
  const property = await create(agent, expenseBody({ propertyId: 'PR-99999' }));
  assert.equal(property.status, 409);
  assert.equal(property.value.code, 'link_missing');
});
