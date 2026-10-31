import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { day, financePath } from './finance-helpers.mjs';
import { DEAL_MESSAGES as M, UNKNOWN, createDeal, dealBody } from './finance-deals-helpers.mjs';
import { dealPath, earnDeal, heldClient, post } from './finance-deals-helpers.mjs';
import { accept, decide, evidence, holderOf, notFound } from './finance-handover-helpers.mjs';
import { offerTo, offered, requestsFor, reviewTeams } from './finance-handover-helpers.mjs';
import { shownVersion, status, withoutApprove } from './finance-handover-helpers.mjs';

// Choosing the approver and what an open request freezes (H2 amendments 1, 13, 14, 16).
let teams;
before(async () => {
  teams = await reviewTeams('h2-rule');
});

/** A refused offer creates no request (400 or 409, never a server error). */
async function refusedOffer(holder, deal, toId, approverId, label) {
  const result = await offerTo(teams.admin, holder, deal, toId, null, { approverId });
  assert.ok([400, 409].includes(result.status), `${label} ${JSON.stringify(result.value)}`);
  assert.equal(typeof result.value?.message, 'string', label);
  assert.equal(requestsFor(deal), '0', `${label}: nothing was created`);
}

/** The deal's live version, so a refusal below is never only a stale version. */
async function current(deal) {
  const { admin } = teams;
  const deals = (await admin.request(financePath(admin))).value.deals;
  return deals.find((row) => row.id === deal.id);
}

// Each deal gets its own client: an accepted hand-over moves the client (§18).
test('the approver holds Approve in this company and is neither the sender nor the receiver', async () => {
  const { admin, agent, second, approver, backup, viewer, third, other, owner } = teams;
  const deal = await createDeal(agent, await heldClient(agent));
  const to = second.user.id;
  await refusedOffer(agent, deal, to, viewer.user.id, 'team view without Approve');
  await refusedOffer(agent, deal, to, third.user.id, 'own-view staff');
  await refusedOffer(agent, deal, to, other.user.id, "another company's Admin");
  await refusedOffer(agent, deal, to, owner.user.id, 'the Super Admin');
  await refusedOffer(agent, deal, to, UNKNOWN, 'an unknown member');
  await refusedOffer(agent, deal, backup.user.id, backup.user.id, 'the receiver');
  await refusedOffer(agent, deal, admin.user.id, approver.user.id, 'the receiver is the Admin');
  const own = await createDeal(backup, await heldClient(backup));
  await refusedOffer(backup, own, to, backup.user.id, 'the sender');
  const held = await createDeal(admin, await heldClient(admin));
  assert.equal(held.assignee.id, admin.user.id);
  await refusedOffer(admin, held, to, approver.user.id, 'the sender is the Admin');
  const malformed = await offerTo(admin, agent, deal, to, null, { approverId: 'someone' });
  assert.equal(malformed.status, 400, JSON.stringify(malformed.value));
  assert.equal(requestsFor(deal), '0');
  const byAdmin = await offered(admin, agent, deal, second, { approver: admin });
  assert.equal(byAdmin.approval.approver.id, admin.user.id, 'the Admin may be the approver');
  const byStaff = await offered(admin, backup, own, second, { approver });
  assert.equal(byStaff.approval.approver.id, approver.user.id);
  const plain = await offerTo(admin, admin, held, to, null, { approverId: null });
  assert.equal(plain.status, 201, JSON.stringify(plain.value));
  assert.equal(plain.value.handover.approval, null, 'a null approver means no approval');
});

test('one open request per deal; the deal cannot be edited or earned while it is open', async () => {
  const { admin, agent, second, third, approver } = teams;
  const client = await heldClient(agent);
  const deal = await createDeal(agent, client);
  const handover = await offered(admin, agent, deal, second, { approver });
  assert.equal((await accept(second, admin, handover)).status, 200);
  let live = await current(deal);
  const again = await offerTo(admin, agent, live, third.user.id);
  assert.equal(again.status, 409, JSON.stringify(again.value));
  assert.equal(requestsFor(deal), '1');
  const fee = await agent.request(dealPath(admin, `/${deal.id}`), {
    method: 'PATCH',
    body: { version: live.version, deal: dealBody(client, { feeRateBp: 300 }) },
  });
  assert.equal(fee.status, 409, JSON.stringify(fee.value));
  const earn = await post(admin, admin, deal.id, 'earn', {
    version: live.version,
    earnedOn: day(0),
  });
  assert.equal(earn.status, 409, JSON.stringify(earn.value));
  assert.notEqual(earn.value.message, M.stale);
  live = await current(deal);
  assert.equal(live.earnedOn, null, 'not earned while the request is open (amendment 16)');
  const earned = await earnDeal(admin, await createDeal(agent, await heldClient(agent)));
  await offered(admin, agent, earned, second);
  live = await current(earned);
  const body = { version: live.version, reason: 'Synthetic' };
  for (const action of ['unearn', 'revise']) {
    const result = await post(admin, admin, earned.id, action, body);
    assert.equal(result.status, 409, `${action} ${JSON.stringify(result.value)}`);
    assert.notEqual(result.value.message, M.stale, action);
  }
  assert.notEqual((await current(earned)).earnedOn, null, 'still earned');
});

test('an approver who loses Approve is skipped; the Admin still approves', async () => {
  const { admin, agent, second, backup } = teams;
  const deal = await createDeal(agent, await heldClient(agent));
  const handover = await offered(admin, agent, deal, second, { approver: backup });
  assert.equal((await accept(second, admin, handover)).status, 200);
  const version = await shownVersion(backup, admin, handover);
  const demoted = await withoutApprove(admin, backup);
  const approve = await decide(demoted, admin, handover, 'approve-acceptance', version);
  notFound(approve, 'approve without the Approve right');
  notFound(await decide(demoted, admin, handover, 'reject-acceptance'), 'reject without it');
  assert.equal(status(handover), 'awaiting_approval', 'the request stays open for the Admin');
  const shown = await shownVersion(admin, admin, handover);
  const approved = await decide(admin, admin, handover, 'approve-acceptance', shown);
  assert.equal(approved.status, 200, JSON.stringify(approved.value));
  assert.equal(approved.value.handover.status, 'approved');
  assert.equal(holderOf(deal), second.user.id);
  const [state, accepted, approvedBy] = evidence(handover).split(/[|,]/);
  assert.deepEqual([state, accepted], ['accepted', 'accepted:member:recipient']);
  assert.match(approvedBy, /^approved:(admin|approver)_decision:recipient$/);
});
