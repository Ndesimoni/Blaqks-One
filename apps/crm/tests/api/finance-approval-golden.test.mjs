import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { createDeal, dealPath, earnDeal, heldClient, overview } from './finance-deals-helpers.mjs';
import { ENTRY, approvalTeams, decide, decided, submit } from './finance-approval-helpers.mjs';
import { paymentBody } from './finance-approval-helpers.mjs';
import { refused } from './finance-helpers.mjs';

let teams, g2, g9;
before(async () => {
  teams = await approvalTeams('fin-appr-gold', { settings: { vatRegistered: false } });
  const { admin, agent, second } = teams;
  const client = await heldClient(second);
  const open = await createDeal(second, client, {
    dealType: 'Rental',
    agreedValueFils: 8_733_333,
    feeRateBp: 500,
    partnerShareBp: 5000,
    partnerName: 'Synthetic Partner Brokerage',
  });
  const split = await admin.request(dealPath(admin, `/${open.id}/split`), {
    method: 'PUT',
    body: {
      version: open.version,
      secondAgentId: agent.user.id,
      secondAgentShareBp: 2500,
      overrideAgentShareBp: null,
      reason: 'Synthetic referral',
    },
  });
  assert.equal(split.status, 200, JSON.stringify(split.value));
  g2 = await earnDeal(admin, split.value.deal);
  g9 = await earnDeal(admin, await createDeal(second, client, { feeRateBp: 0 }));
});

const line = async (who, dealId) =>
  (await overview(who, teams.admin)).statement.lines.find((row) => row.dealId === dealId);

test('G6: a partial payment on G2 (VAT off) splits pro rata, floored per line', async () => {
  const { admin, agent, second, approver } = teams;
  assert.equal(g2.calculation.netFils, 218_333);
  const payment = await submit(
    second,
    admin,
    'payments',
    paymentBody(g2.dealId, { amountFils: 100_000 }),
  );
  assert.deepEqual([payment.vatFils, payment.totalFils], [0, 100_000]);
  await decided(approver, admin, 'payments', payment, 'approve');
  const primary = await line(second, g2.dealId);
  assert.deepEqual(
    [primary.amountFils, primary.receivedShareFils, primary.outstandingFils],
    [81_875, 37_500, 44_375],
  );
  const referral = await line(agent, g2.dealId);
  assert.deepEqual(referral, {
    dealId: g2.dealId,
    earnedOn: g2.earnedOn,
    dealType: 'Rental',
    role: 'second',
    amountFils: 27_291,
    receivedShareFils: 12_499,
    outstandingFils: 14_792,
  });
  const deal = (await overview(admin)).deals.find((row) => row.id === g2.id);
  assert.deepEqual([deal.receivedFils, deal.outstandingFils], [100_000, 118_333]);
  const theirs = await overview(agent, admin);
  assert.ok(
    !theirs.payments.some((row) => row.dealId === g2.dealId),
    'second agents see no payments',
  );
});

test('G9: a zero-fee deal has a zero line and accepts no approved payment', async () => {
  const { admin, second, approver } = teams;
  assert.deepEqual(await line(second, g9.dealId), {
    dealId: g9.dealId,
    earnedOn: g9.earnedOn,
    dealType: 'Sale',
    role: 'primary',
    shareBp: 5000,
    amountFils: 0,
    receivedShareFils: 0,
    outstandingFils: 0,
    adjusted: false,
  });
  const payment = await submit(
    second,
    admin,
    'payments',
    paymentBody(g9.dealId, { amountFils: 1 }),
  );
  refused(
    await decide(approver, admin, 'payments', payment, 'approve'),
    409,
    ENTRY.over,
    'conflict',
  );
});
