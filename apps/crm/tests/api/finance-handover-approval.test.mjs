import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { refused } from './finance-helpers.mjs';
import { DEAL_MESSAGES as M, createDeal, heldClient, overview } from './finance-deals-helpers.mjs';
import { sortedKeys } from './finance-deals-helpers.mjs';
import { EXPIRED, read, stored } from './agreements-handover-helpers.mjs';
import { accept, decide, evidence, expire, holderOf } from './finance-handover-helpers.mjs';
import { notFound, offered, reviewTeams, shownVersion } from './finance-handover-helpers.mjs';
import { status, stranded } from './finance-handover-helpers.mjs';

// Approval chosen by the sender (agreements design §17 item 4, H2 amendments 2–5, 14, 15).
let teams;
before(async () => {
  teams = await reviewTeams('h2-flow');
});

const ALLOWED = [
  ...['accept', 'approve', 'approveAcceptance', 'cancel', 'decline'],
  ...['rejectAcceptance', 'review'],
];
const lastActor = (handover) =>
  query(`SELECT coalesce(actor_id::text,'-') FROM agreements.crm_agreement_events
    WHERE agreement_id='${handover.agreementId}' ORDER BY created_at DESC LIMIT 1`);

/** A deal offered to `second` with `approver` chosen, and accepted by `second`. */
async function awaiting() {
  const { admin, agent, second, approver } = teams;
  const deal = await createDeal(agent, await heldClient(agent));
  const offer = await offered(admin, agent, deal, second, { approver });
  const accepted = await accept(second, admin, offer);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.value));
  return { deal, handover: accepted.value.handover };
}

// Each deal gets its own client: an accepted hand-over moves the client (§18).
test('the receiver accepts first; only the approval moves the deal', async () => {
  const { admin, agent, second, approver } = teams;
  const deal = await createDeal(agent, await heldClient(agent));
  const handover = await offered(admin, agent, deal, second, { share: 1500, approver });
  assert.deepEqual([handover.status, handover.toAdmin], ['pending', false]);
  const named = { approver: { id: approver.user.id, name: approver.user.name }, acceptedAt: null };
  assert.deepEqual(handover.approval, named);
  assert.match(handover.expiresAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(sortedKeys(handover.allowed), ALLOWED);
  const stale = await decide(second, admin, handover, 'accept', { agreementVersion: 1 });
  assert.equal(stale.status, 409, JSON.stringify(stale.value));
  const accepted = await accept(second, admin, handover);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.value));
  assert.equal(accepted.value.entry, null);
  assert.equal(accepted.value.handover.status, 'awaiting_approval');
  assert.match(accepted.value.handover.approval.acceptedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(holderOf(deal), agent.user.id, 'nothing moves before the approval');
  assert.equal(evidence(handover), 'sent|accepted:member:recipient', 'amendment 3');
  const listed = (await overview(approver, admin)).handovers.find((h) => h.id === handover.id);
  const { approveAcceptance, rejectAcceptance, review } = listed.allowed;
  assert.deepEqual(
    [listed.status, approveAcceptance, rejectAcceptance, review],
    ['awaiting_approval', true, true, true],
  );
  const shown = await shownVersion(approver, admin, handover);
  const old = { agreementVersion: shown.agreementVersion - 1 };
  const outdated = await decide(approver, admin, handover, 'approve-acceptance', old);
  assert.equal(outdated.status, 409, JSON.stringify(outdated.value));
  const approved = await decide(approver, admin, handover, 'approve-acceptance', shown);
  assert.equal(approved.status, 200, JSON.stringify(approved.value));
  assert.equal(approved.value.handover.status, 'approved');
  assert.equal(approved.value.handover.referralShareBp, 1500, 'the share is unchanged');
  assert.equal(approved.value.entry.assignee.id, second.user.id);
  assert.equal(holderOf(deal), second.user.id);
  assert.equal((await read(second, admin, handover)).value.agreement.state, 'accepted');
  const both = 'accepted|accepted:member:recipient,approved:approver_decision:recipient';
  assert.equal(evidence(handover), both);
  const approvedBy = query(`SELECT actor_id FROM agreements.crm_agreement_actions
    WHERE agreement_id='${handover.agreementId}' AND action='approved'`);
  assert.equal(approvedBy, approver.user.id);
  const people = query(`SELECT accepted_by||'|'||decided_by FROM crm_deal_handovers
    WHERE id='${handover.id}'`);
  assert.equal(people, `${second.user.id}|${approver.user.id}`, 'decided_by is not overwritten');
  const revisions = query(`SELECT count(*) FROM agreements.crm_agreement_revisions
    WHERE agreement_id='${handover.agreementId}'`);
  assert.equal(revisions, '1', 'the approval writes no revision (amendment 4)');
});

test('the approver may reject and the holder may cancel; the receiver cannot withdraw', async () => {
  const { admin, agent, second, approver, viewer } = teams;
  const rejected = await awaiting();
  const { handover } = rejected;
  refused(await decide(second, admin, handover, 'decline'), 409, M.notPending, 'conflict');
  notFound(await decide(second, admin, handover, 'cancel'), 'the receiver cannot cancel');
  const version = await shownVersion(admin, admin, handover);
  for (const [who, label] of [
    [second, 'the receiver never approves'],
    [agent, 'the holder'],
    [viewer, 'team-view staff'],
  ]) {
    notFound(await decide(who, admin, handover, 'approve-acceptance', version), label);
    notFound(await decide(who, admin, handover, 'reject-acceptance'), label);
  }
  const inPlace = { referralShareBp: null, reason: 'Synthetic', ...version };
  refused(await decide(admin, admin, handover, 'approve', inPlace), 409, M.notPending, 'conflict');
  const reject = await decide(approver, admin, handover, 'reject-acceptance');
  assert.equal(reject.status, 200, JSON.stringify(reject.value));
  assert.equal(reject.value.handover.status, 'cancelled');
  assert.equal(holderOf(rejected.deal), agent.user.id);
  assert.equal(stored(handover), 'revoked|revoked|-');
  assert.equal(lastActor(handover), approver.user.id, 'withdrawn by the approver');
  const cancelled = await awaiting();
  const cancel = await decide(agent, admin, cancelled.handover, 'cancel');
  assert.equal(cancel.status, 200, JSON.stringify(cancel.value));
  assert.equal(cancel.value.handover.status, 'cancelled');
  assert.equal(holderOf(cancelled.deal), agent.user.id);
  assert.equal(stored(cancelled.handover), 'revoked|revoked|sender');
  assert.equal(stranded(), '0');
});

test('approving an acceptance needs one that waits, before the offer ends', async () => {
  const { admin, agent, second, approver } = teams;
  const pending = await offered(
    admin,
    agent,
    await createDeal(agent, await heldClient(agent)),
    second,
    {
      approver,
    },
  );
  const early = await shownVersion(admin, admin, pending);
  const tooSoon = await decide(approver, admin, pending, 'approve-acceptance', early);
  refused(tooSoon, 409, M.notPending, 'conflict');
  refused(
    await decide(approver, admin, pending, 'reject-acceptance'),
    409,
    M.notPending,
    'conflict',
  );
  const late = await awaiting();
  expire(late.handover);
  const version = await shownVersion(approver, admin, late.handover);
  for (const who of [approver, admin]) {
    const result = await decide(who, admin, late.handover, 'approve-acceptance', version);
    refused(result, 409, EXPIRED, 'conflict', who.user.email);
  }
  assert.equal(status(late.handover), 'awaiting_approval');
  const cancel = await decide(admin, admin, late.handover, 'cancel');
  assert.equal(cancel.status, 200, JSON.stringify(cancel.value));
  assert.equal(holderOf(late.deal), agent.user.id);
  assert.equal(stored(late.handover), 'revoked|revoked|-');
  assert.equal(stranded(), '0');
});
