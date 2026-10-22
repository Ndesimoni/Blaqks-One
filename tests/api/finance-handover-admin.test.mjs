import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { FINANCE } from './permission-helpers.mjs';
import { financePath } from './finance-helpers.mjs';
import { createDeal, heldClient, overview, seen, sortedKeys } from './finance-deals-helpers.mjs';
import { accept, decide, evidence, financeStaff, holderOf } from './finance-handover-helpers.mjs';
import { notFound, offerTo, offered, preview, requestsFor } from './finance-handover-helpers.mjs';
import { reviewTeams, status } from './finance-handover-helpers.mjs';

// Hand-overs to the company's own Admin (agreements design §17 item 3, H2 amendment 12) and
// the list of approvers the sender chooses from (H2 API contract).
let teams, client;
before(async () => {
  teams = await reviewTeams('h2-boss');
  client = await heldClient(teams.agent);
});

test('staff hand a deal fully to their Admin, who reviews and accepts it like an agent', async () => {
  const { admin, agent } = teams;
  const deal = await createDeal(agent, client);
  const handover = await offered(admin, agent, deal, admin);
  assert.deepEqual([handover.status, handover.toAdmin, handover.approval], ['pending', true, null]);
  assert.equal(handover.to.id, admin.user.id);
  const listed = (await overview(admin)).handovers.find((h) => h.id === handover.id);
  const { review, accept: accepts, decline, approve } = listed.allowed;
  assert.deepEqual([review, accepts, decline, approve], [true, true, true, false]);
  const shown = await preview(admin, admin, handover.id);
  assert.equal(shown.status, 200, JSON.stringify(shown.value));
  assert.deepEqual([shown.value.offer.kind, shown.value.offer.referralShareBp], ['full', null]);
  assert.equal(shown.value.deal.receiverEarnsFils, 0, 'an Admin-held deal earns no commission');
  assert.equal(shown.value.property, null);
  const inPlace = {
    referralShareBp: null,
    reason: 'Synthetic',
    ...(await seen(admin, admin, handover)),
  };
  notFound(await decide(admin, admin, handover, 'approve', inPlace), 'no approval of oneself');
  assert.equal(status(handover), 'pending');
  const accepted = await accept(admin, admin, handover);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.value));
  assert.equal(accepted.value.handover.status, 'accepted');
  assert.equal(accepted.value.entry.assignee.id, admin.user.id);
  assert.equal(holderOf(deal), admin.user.id);
  assert.equal(evidence(handover), 'accepted|accepted:member:recipient');
});

test('a hand-over to the Admin is full and without approval, and never to the Super Admin', async () => {
  const { admin, agent, approver, owner, other } = teams;
  const deal = await createDeal(agent, client);
  for (const [toId, share, extra, label] of [
    [admin.user.id, 1000, {}, 'a referral to the Admin'],
    [admin.user.id, null, { approverId: approver.user.id }, 'an approval step to the Admin'],
    [owner.user.id, null, {}, 'the Super Admin'],
    [other.user.id, null, {}, "another company's Admin"],
  ]) {
    const result = await offerTo(admin, agent, deal, toId, share, extra);
    assert.ok([400, 409].includes(result.status), `${label} ${JSON.stringify(result.value)}`);
    assert.equal(typeof result.value?.message, 'string', label);
    assert.equal(requestsFor(deal), '0', `${label}: nothing was created`);
  }
  const declined = await offered(admin, agent, deal, admin);
  const answer = await decide(admin, admin, declined, 'decline');
  assert.equal(answer.status, 200, JSON.stringify(answer.value));
  assert.equal(answer.value.handover.status, 'declined');
  assert.equal(holderOf(deal), agent.user.id);
});

test('the approvers list names the Admin and staff with Approve, without the caller', async () => {
  const { admin, agent, approver, backup, desk } = teams;
  const path = financePath(admin, '/approvers');
  const list = async (session) => {
    const result = await session.request(path);
    assert.equal(result.status, 200, JSON.stringify(result.value));
    assert.deepEqual(Object.keys(result.value), ['approvers']);
    for (const row of result.value.approvers) assert.deepEqual(sortedKeys(row), ['id', 'name']);
    return result.value.approvers.map((row) => `${row.id}|${row.name}`).sort();
  };
  const named = (...sessions) => sessions.map((s) => `${s.user.id}|${s.user.name}`).sort();
  assert.deepEqual(await list(agent), named(admin, approver, backup));
  assert.deepEqual(await list(approver), named(admin, backup));
  assert.deepEqual(await list(admin), named(approver, backup));
  assert.equal((await desk.request(path)).status, 403, 'no finance module');
  const noAssign = { ...FINANCE.preset, assign: false };
  const member = await financeStaff(admin, 'h2-boss-noassign', noAssign);
  assert.equal((await member.request(path)).status, 403, 'no Assign right');
});
