import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { events, refused } from './finance-helpers.mjs';
import { createDeal, dealPath, earnDeal, overview } from './finance-deals-helpers.mjs';
import {
  ENTRY,
  approvalTeams,
  decide,
  decided,
  edit,
  submit,
} from './finance-approval-helpers.mjs';
import { expenseBody, paymentBody, paymentFields } from './finance-approval-helpers.mjs';

let teams, shared, moved;
before(async () => {
  teams = await approvalTeams('fin-appr-sod');
  const { admin, agent, approver, approver2, client } = teams;
  const open = await createDeal(agent, client);
  const split = await admin.request(dealPath(admin, `/${open.id}/split`), {
    method: 'PUT',
    body: {
      version: open.version,
      secondAgentId: approver2.user.id,
      secondAgentShareBp: 2000,
      overrideAgentShareBp: null,
      reason: 'Synthetic co-listing',
    },
  });
  assert.equal(split.status, 200, JSON.stringify(split.value));
  shared = await earnDeal(admin, split.value.deal);
  const other = await earnDeal(admin, await createDeal(agent, client));
  const move = await admin.request(dealPath(admin, `/${other.id}/assignee`), {
    method: 'PUT',
    body: { version: other.version, assigneeId: approver.user.id, reason: 'Synthetic cover' },
  });
  assert.equal(move.status, 200, JSON.stringify(move.value));
  moved = move.value.entry;
});

const P = 'payments';
const act = (who, entry, verdict = 'approve', body) =>
  decide(who, teams.admin, P, entry, verdict, body);
const put = async (who, entry, changes) => {
  const result = await edit(who, teams.admin, P, entry, paymentFields(entry, changes));
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value.payment;
};
const own = (result) => refused(result, 403, ENTRY.own, 'forbidden');
const allowedFor = async (who, entry) =>
  (await overview(who, teams.admin)).payments.find((row) => row.id === entry.id).allowed;

test('staff approvers never decide what they submitted or last edited (M-F6)', async () => {
  const { admin, agent, approver, approver2 } = teams;
  const mine = await submit(approver, admin, P, paymentBody(teams.deal.dealId));
  own(await act(approver, mine));
  own(await act(approver, mine, 'reject', { reason: 'Mine' }));
  assert.deepEqual(await allowedFor(approver, mine), {
    edit: true,
    approve: false,
    reject: false,
    void: false,
  });
  assert.equal((await allowedFor(approver2, mine)).approve, true);
  await decided(approver2, admin, P, mine, 'approve');
  const edited = await put(
    approver,
    await submit(agent, admin, P, paymentBody(teams.deal.dealId)),
    {
      amountFils: 900_000,
    },
  );
  own(await act(approver, edited));
  await decided(approver2, admin, P, edited, 'approve');
});

test('an edit since the last submission blocks approval even after a trivial edit by another', async () => {
  const { admin, agent, approver, approver2 } = teams;
  let payment = await submit(agent, admin, P, paymentBody(teams.deal.dealId));
  payment = await put(approver, payment, { notes: 'Checked against the bank' });
  payment = await put(agent, payment, { notes: 'Checked against the bank.' });
  own(await act(approver, payment));
  assert.equal((await allowedFor(approver, payment)).approve, false);
  payment = await decided(approver2, admin, P, payment, 'reject', { reason: 'Missing slip' });
  payment = await put(agent, payment, { reference: 'SLIP-1' });
  assert.equal((await allowedFor(approver, payment)).approve, true, 'a new submission resets it');
  await decided(approver, admin, P, payment, 'approve');
  let resubmitted = await submit(agent, admin, P, paymentBody(teams.deal.dealId));
  resubmitted = await decided(approver2, admin, P, resubmitted, 'reject', { reason: 'Recheck' });
  resubmitted = await put(approver, resubmitted, {});
  own(await act(approver, resubmitted));
  await decided(approver2, admin, P, resubmitted, 'approve');
});

test('holders, second agents and expense owners never approve their own money', async () => {
  const { admin, agent, approver, approver2 } = teams;
  const onShared = await submit(agent, admin, P, paymentBody(shared.dealId));
  own(await act(approver2, onShared));
  await decided(approver, admin, P, onShared, 'approve');
  const onMoved = await submit(admin, admin, P, paymentBody(moved.dealId));
  own(await act(approver, onMoved));
  await decided(approver2, admin, P, onMoved, 'approve');
  const forApprover = expenseBody({ incurredBy: approver.user.id });
  const expense = await submit(admin, admin, 'expenses', forApprover);
  own(await decide(approver, admin, 'expenses', expense, 'approve'));
  await decided(approver2, admin, 'expenses', expense, 'approve');
});

test('Admins may decide their own rows, recorded as selfDecided', async () => {
  const { admin, agent, approver } = teams;
  const mine = await submit(admin, admin, P, paymentBody(teams.deal.dealId, { amountFils: 1 }));
  const approved = await decided(admin, admin, P, mine, 'approve');
  assert.equal(approved.status, 'approved');
  assert.deepEqual(events(mine.id).at(-1).changes, {
    status: ['pending', 'approved'],
    selfDecided: true,
  });
  const theirs = await submit(agent, admin, P, paymentBody(teams.deal.dealId, { amountFils: 1 }));
  await decided(admin, admin, P, theirs, 'approve');
  assert.equal(events(theirs.id).at(-1).changes.selfDecided, undefined);
  const expense = await submit(admin, admin, 'expenses', expenseBody());
  const decision = await decided(admin, admin, 'expenses', expense, 'reject', { reason: 'Own' });
  assert.equal(decision.status, 'rejected');
  assert.equal(events(expense.id).at(-1).changes.selfDecided, true);
  own(await act(approver, await submit(approver, admin, P, paymentBody(teams.deal.dealId))));
});
