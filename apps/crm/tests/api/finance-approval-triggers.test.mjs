import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { failure } from './finance-helpers.mjs';
import {
  approvalTeams,
  decided,
  expenseBody,
  paymentBody,
  submit,
} from './finance-approval-helpers.mjs';

let teams, approved, pending, voided, expense;
before(async () => {
  teams = await approvalTeams('fin-appr-trig');
  const { admin, agent, approver } = teams;
  const pay = () => submit(agent, admin, 'payments', paymentBody(teams.deal.dealId));
  approved = await decided(approver, admin, 'payments', await pay(), 'approve');
  pending = await pay();
  const toVoid = await decided(approver, admin, 'payments', await pay(), 'approve');
  voided = await decided(admin, admin, 'payments', toVoid, 'void', { reason: 'Synthetic' });
  const forApprover = expenseBody({ incurredBy: approver.user.id });
  expense = await submit(admin, admin, 'expenses', forApprover);
});

const payments = (set, id) => `UPDATE crm_payments SET ${set} WHERE id='${id}'`;
const bypass = (sql) =>
  `BEGIN; SELECT set_config('kws.finance_admin','on',true); ${sql}; ROLLBACK;`;
const LOCKED = /Approved finance records are locked/;

test('approved rows change only on the Admin path; void and deletes never (M-F7)', () => {
  for (const set of ["notes='x'", 'amount_fils=1', "status='void'"]) {
    assert.match(failure(payments(set, approved.id)), LOCKED, set);
  }
  query(bypass(payments("notes='Admin path'", approved.id)));
  assert.match(failure(bypass(payments("notes='x'", voided.id))), LOCKED);
  assert.match(failure(payments("status='approved'", voided.id)), LOCKED);
  for (const table of ['crm_payments', 'crm_expenses']) {
    const sql = `DELETE FROM ${table} WHERE workspace_id='${teams.admin.user.workspaceId}'`;
    assert.match(failure(bypass(sql)), /cannot be deleted/, table);
  }
});

test('the bypass is transaction-local, so a pooled connection never keeps it', () => {
  const after = query(`BEGIN; SELECT set_config('kws.finance_admin','on',true); COMMIT;
    SELECT 'value:' || COALESCE(current_setting('kws.finance_admin', true), '')`);
  assert.equal(after.split('\n').at(-1), 'value:', 'the setting ends with its transaction');
  const reused = `BEGIN; SELECT set_config('kws.finance_admin','on',true); COMMIT;
    ${payments("notes='x'", approved.id)}`;
  assert.match(failure(reused), LOCKED);
});

test('identity, deal, transitions and dates are guarded', () => {
  const id = pending.id;
  for (const set of [
    "deal_ref='DL-999'",
    "legacy_id='PM-999'",
    `submitted_by='${teams.admin.user.id}'`,
  ]) {
    assert.match(failure(payments(set, id)), /identity and deal cannot change/, set);
  }
  const voidPending = `status='void',decided_by='${teams.admin.user.id}',decided_at=now(),
    decision_reason='x'`;
  assert.match(failure(bypass(payments(voidPending, id))), /Invalid finance status change/);
  const future = "receipt_date=((now() AT TIME ZONE 'Asia/Dubai')::date + 1)";
  assert.match(failure(payments(future, id)), /cannot be in the future/);
  const insert = `INSERT INTO crm_payments (id,workspace_id,legacy_id,deal_ref,receipt_date,
    amount_fils,vat_fils,status,submitted_by,last_edited_by,decided_by,decided_at)
    SELECT gen_random_uuid(),workspace_id,'PM-777',deal_ref,receipt_date,1,0,'approved',
    submitted_by,submitted_by,'${teams.admin.user.id}',now() FROM crm_payments WHERE id='${id}'`;
  assert.match(failure(insert), /start pending/);
  assert.match(failure(payments("status='rejected'", id)), /crm_payments_decision/);
  const http = `UPDATE crm_expenses SET receipt_url='http://files.example.test/r.pdf'
    WHERE id='${expense.id}'`;
  assert.match(failure(http), /crm_expenses_receipt_url_check|check constraint/);
  const foreign = `UPDATE crm_expenses SET incurred_by='${teams.other.user.id}'
    WHERE id='${expense.id}'`;
  assert.match(failure(foreign), /not an active member/);
});

test('separation of duties and the net cap hold in the database (M-F4, M-F6)', () => {
  const decide = (who, extra = '') =>
    `status='approved',decided_by='${who}',decided_at=now()${extra}`;
  const agent = teams.agent.user.id;
  assert.match(failure(payments(decide(agent), pending.id)), /Another approver must decide/);
  const own = `UPDATE crm_expenses SET ${decide(teams.approver.user.id)} WHERE id='${expense.id}'`;
  assert.match(failure(own), /Another approver must decide/);
  const over = decide(teams.approver2.user.id, ',amount_fils=4900000');
  assert.match(failure(payments(over, pending.id)), /exceed the deal net/);
  const sum = query(`SELECT crm_deal_approved_fils('${teams.deal.id}')`);
  assert.equal(sum, String(approved.amountFils), 'approved only; pending and void excluded');
});
