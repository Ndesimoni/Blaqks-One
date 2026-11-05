import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { refused } from './finance-helpers.mjs';
import { createDeal, dealPath, earnDeal } from './finance-deals-helpers.mjs';
import { heldClient, overview, post } from './finance-deals-helpers.mjs';
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
  teams = await approvalTeams('fin-appr-money', { agreement: true });
});

const P = 'payments';
const line = async (who, dealId) =>
  (await overview(who, teams.admin)).statement.lines.find((row) => row.dealId === dealId);
const dealView = async (dealId) =>
  (await overview(teams.admin)).deals.find((deal) => deal.dealId === dealId);

test('G5: VAT per payment, pro-rata received shares and only approved payments count', async () => {
  const { admin, agent, approver } = teams;
  const { dealId } = teams.deal;
  const payment = await submit(agent, admin, P, paymentBody(dealId, { amountFils: 2_450_000 }));
  assert.deepEqual([payment.vatFils, payment.totalFils], [122_500, 2_572_500]);
  const pending = await line(agent, dealId);
  assert.deepEqual([pending.amountFils, pending.receivedShareFils], [2_940_000, 0], 'pending');
  await decided(approver, admin, P, payment, 'approve');
  assert.deepEqual(await line(agent, dealId), {
    ...pending,
    receivedShareFils: 1_470_000,
    outstandingFils: 1_470_000,
  });
  const deal = await dealView(dealId);
  assert.deepEqual(
    [deal.receivedFils, deal.outstandingFils, deal.paymentStatus],
    [2_450_000, 2_450_000, 'outstanding'],
  );
  const totals = (await overview(admin)).teamTotals;
  assert.deepEqual([totals.receivedFils, totals.outstandingFils], [2_450_000, 2_450_000]);
  assert.equal(query(`SELECT crm_deal_approved_fils('${teams.deal.id}')`), '2450000');
});

test('approvals are capped at the net; void releases room; unearn and revise respect them', async () => {
  const { admin, agent, approver } = teams;
  const { dealId } = teams.deal;
  let over = await submit(agent, admin, P, paymentBody(dealId, { amountFils: 2_450_001 }));
  refused(await decide(approver, admin, P, over, 'approve'), 409, ENTRY.over, 'conflict');
  const fixed = await edit(agent, admin, P, over, paymentFields(over, { amountFils: 2_450_000 }));
  over = await decided(approver, admin, P, fixed.value.payment, 'approve');
  const paid = await dealView(dealId);
  assert.deepEqual([paid.outstandingFils, paid.paymentStatus], [0, 'paid']);
  assert.equal((await line(agent, dealId)).receivedShareFils, 2_940_000);
  const extra = await submit(agent, admin, P, paymentBody(dealId, { amountFils: 1 }));
  refused(await decide(approver, admin, P, extra, 'approve'), 409, ENTRY.over, 'conflict');
  const unearn = await post(admin, admin, teams.deal.id, 'unearn', {
    version: paid.version,
    reason: 'Synthetic cancellation',
  });
  refused(unearn, 409, "Void this deal's approved payments first.", 'conflict');
  const terms = await admin.request(dealPath(admin, `/${teams.deal.id}`), {
    method: 'PATCH',
    body: { deal: { ...dealBodyOf(paid), agreedValueFils: 100_000_000 }, version: paid.version },
  });
  assert.equal(terms.status, 200, JSON.stringify(terms.value));
  const revise = await post(admin, admin, teams.deal.id, 'revise', {
    version: terms.value.deal.version,
    reason: 'Synthetic lower value',
  });
  refused(revise, 409, 'Void approved payments first.', 'conflict');
  await decided(admin, admin, P, over, 'void', { reason: 'Bounced' });
  assert.equal((await line(agent, dealId)).receivedShareFils, 1_470_000, 'void no longer counts');
  await decided(approver, admin, P, extra, 'approve');
});

test('payments need an earned deal, also when approving after an unearn (M-F4)', async () => {
  const { admin, agent, approver } = teams;
  const open = await createDeal(agent, await heldClient(agent));
  const early = await agent.request(`/workspaces/${admin.user.workspaceId}/finance/payments`, {
    method: 'POST',
    body: { payment: paymentBody(open.dealId) },
  });
  refused(early, 409, ENTRY.notEarned, 'conflict');
  const earned = await earnDeal(admin, open);
  const payment = await submit(agent, admin, P, paymentBody(earned.dealId));
  const unearned = await post(admin, admin, earned.id, 'unearn', {
    version: earned.version,
    reason: 'Synthetic reversal',
  });
  assert.equal(unearned.status, 200, JSON.stringify(unearned.value));
  refused(await decide(approver, admin, P, payment, 'approve'), 409, ENTRY.notEarned, 'conflict');
  const rejected = await decided(approver, admin, P, payment, 'reject', { reason: 'Not earned' });
  assert.equal(rejected.status, 'rejected');
});

function dealBodyOf(deal) {
  const keys = ['clientId', 'propertyId', 'dealType', 'stage', 'agreedValueFils', 'feeBasis'];
  const more = ['feeRateBp', 'fixedFeeFils', 'partnerShareBp', 'partnerName', 'details'];
  return Object.fromEntries([...keys, ...more].map((key) => [key, deal[key]]));
}
