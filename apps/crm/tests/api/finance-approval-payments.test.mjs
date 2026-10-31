import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { events, financePath, refused } from './finance-helpers.mjs';
import {
  ENTRY,
  approvalTeams,
  decide,
  decided,
  edit,
  submit,
} from './finance-approval-helpers.mjs';
import { paymentBody, paymentFields } from './finance-approval-helpers.mjs';

let teams;
before(async () => {
  teams = await approvalTeams('fin-appr-pay');
});

const P = 'payments';
const act = (who, entry, verdict, body) => decide(who, teams.admin, P, entry, verdict, body);
const put = (who, entry, changes = {}, extra = {}) =>
  edit(who, teams.admin, P, entry, paymentFields(entry, changes), extra);
const actions = (id) => events(id).map((event) => event.action);

test('payments: pending edits, approval, Admin-only approved edits and terminal void', async () => {
  const { admin, agent, approver, approver2 } = teams;
  const body = paymentBody(teams.deal.dealId, { reference: 'INV-1' });
  let payment = await submit(agent, admin, P, body);
  assert.match(payment.paymentId, /^PM-\d{3,}$/);
  assert.deepEqual([payment.status, payment.decidedBy], ['pending', null]);
  assert.deepEqual([payment.vatFils, payment.totalFils], [50_000, 1_050_000]);
  assert.deepEqual(payment.submittedBy, { id: agent.user.id, name: agent.user.name });
  let result = await put(agent, payment, { amountFils: 1_200_000 });
  assert.equal(result.status, 200, JSON.stringify(result.value));
  payment = result.value.payment;
  assert.deepEqual([payment.status, payment.version, payment.vatFils], ['pending', 2, 60_000]);
  payment = await decided(approver, admin, P, payment, 'approve');
  assert.equal(payment.status, 'approved');
  assert.deepEqual(payment.decidedBy, { id: approver.user.id, name: approver.user.name });
  refused(await act(approver2, payment, 'approve'), 409, ENTRY.decided, 'conflict');
  refused(await act(approver2, payment, 'reject', { reason: 'x' }), 409, ENTRY.decided, 'conflict');
  for (const staff of [agent, approver]) {
    refused(await put(staff, payment), 403, ENTRY.locked, 'forbidden');
  }
  const amount = { amountFils: 1_300_000 };
  refused(await put(admin, payment, amount), 400, ENTRY.reason, 'invalid_request');
  result = await put(admin, payment, amount, { reason: 'Bank statement' });
  assert.equal(result.status, 200, JSON.stringify(result.value));
  payment = result.value.payment;
  assert.deepEqual(
    [payment.status, payment.amountFils, payment.vatFils],
    ['approved', 1_300_000, 65_000],
  );
  const reason = { reason: 'Duplicate receipt' };
  refused(await act(approver, payment, 'void', reason), 403, ENTRY.manage, 'forbidden');
  payment = await decided(admin, admin, P, payment, 'void', reason);
  assert.deepEqual([payment.status, payment.reason], ['void', 'Duplicate receipt']);
  refused(await put(admin, payment, {}, { reason: 'x' }), 409, ENTRY.voided, 'conflict');
  refused(await act(admin, payment, 'void', reason), 409, ENTRY.voided, 'conflict');
  refused(await act(admin, payment, 'approve'), 409, ENTRY.decided, 'conflict');
  refused(await put(agent, payment), 403, ENTRY.locked, 'forbidden');
  assert.deepEqual(actions(payment.id), ['submitted', 'updated', 'approved', 'updated', 'voided']);
  const activity = query(`SELECT string_agg(action, ',' ORDER BY created_at) FROM crm_activity
    WHERE record_id='${payment.id}' AND collection='Payments'`);
  assert.equal(activity, 'created,updated,approved,updated,voided');
  const [, , approved, adminEdit, voided] = events(payment.id);
  assert.deepEqual(approved.changes, { status: ['pending', 'approved'] });
  assert.deepEqual(adminEdit.changes, {
    amountFils: [1_200_000, 1_300_000],
    vatFils: [60_000, 65_000],
  });
  assert.equal(adminEdit.reason, 'Bank statement');
  assert.deepEqual(
    [voided.changes, voided.reason],
    [{ status: ['approved', 'void'] }, 'Duplicate receipt'],
  );
});

test('payment deals are fixed and bodies, dates and deals are validated', async () => {
  const { admin, agent } = teams;
  const deal = teams.deal.dealId;
  const payment = await submit(agent, admin, P, paymentBody(deal));
  refused(await put(agent, payment, { dealId: 'DL-999' }), 400, ENTRY.fixed, 'invalid_request');
  assert.equal(
    (await put(agent, payment, { dealId: deal, notes: 'Echo' })).status,
    200,
    'an echo is accepted',
  );
  const create = (body) =>
    agent.request(financePath(admin, '/payments'), { method: 'POST', body: { payment: body } });
  const future = paymentBody(deal, { receiptDate: '2099-01-01' });
  refused(await create(future), 400, ENTRY.future, 'invalid_request');
  const issued = { ...paymentBody(deal), paymentId: 'PM-900' };
  refused(await create(issued), 400, ENTRY.issued, 'invalid_request');
  for (const amountFils of [0, 10.5, '100', -1, 1_000_000_000_001]) {
    refused(await create(paymentBody(deal, { amountFils })), 400, ENTRY.money, 'invalid_request');
  }
  const extra = { ...paymentBody(deal), vatFils: 1 };
  refused(await create(extra), 400, ENTRY.payment, 'invalid_request');
  refused(await create(paymentBody('DL-999')), 409, ENTRY.dealMissing, 'link_missing');
  const stale = await put(agent, payment, {}, {});
  refused(stale, 409, ENTRY.stale, 'version_conflict');
  const patch = (body) =>
    agent.request(financePath(admin, `/payments/${payment.id}`), { method: 'PATCH', body });
  const fields = paymentFields(payment);
  refused(await patch({ payment: fields }), 400, ENTRY.payment, 'invalid_request');
  refused(
    await patch({ payment: fields, version: 2, extra: 1 }),
    400,
    ENTRY.payment,
    'invalid_request',
  );
});
