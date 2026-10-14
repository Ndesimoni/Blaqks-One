import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { events, financePath, refused } from './finance-helpers.mjs';
import { DEAL_MESSAGES as M, UNKNOWN, createDeal, dealTeams } from './finance-deals-helpers.mjs';
import { earnDeal, heldClient, overview, post } from './finance-deals-helpers.mjs';

let teams, client, deal;
before(async () => {
  teams = await dealTeams('fin-hand', { maxReferralShareBp: 2000, secondAgentSource: 'company' });
  client = await heldClient(teams.agent);
  deal = await createDeal(teams.agent, client);
});

const offer = (session, target, toId, referralShareBp = null) =>
  post(session, teams.admin, target.id, 'handovers', {
    version: target.version,
    toId,
    referralShareBp,
  });
const decide = (session, id, action, body) =>
  session.request(financePath(teams.admin, `/handovers/${id}/${action}`), { method: 'POST', body });

test('only the holder offers a deal, to active finance staff, within the referral cap', async () => {
  const { agent, viewer, second, desk, admin } = teams;
  refused(await offer(viewer, deal, second.user.id), 403, M.holderOnly, 'forbidden');
  for (const to of [agent.user.id, desk.user.id, admin.user.id, UNKNOWN]) {
    refused(await offer(agent, deal, to), 400, M.ineligible, 'invalid_request', to);
  }
  refused(await offer(agent, deal, second.user.id, 2500), 409, M.cap, 'conflict');
  const made = await offer(agent, deal, second.user.id, 1500);
  assert.equal(made.status, 201, JSON.stringify(made.value));
  const { handover } = made.value;
  assert.equal(handover.status, 'pending');
  const offered = (await overview(second, admin)).handovers;
  assert.deepEqual(
    offered.map((h) => [h.id, h.referralShareBp, h.allowed.accept]),
    [[handover.id, 1500, true]],
  );
  assert.deepEqual(Object.keys(offered[0]).sort(), [
    ...['allowed', 'createdAt', 'dealId', 'dealType', 'earned', 'from', 'id'],
    ...['referralShareBp', 'stage', 'status', 'to'],
  ]);
  assert.equal((await overview(agent, admin)).deals[0].pendingHandover, handover.id);
  refused(
    await offer(agent, deal, second.user.id),
    409,
    'This deal already has a pending hand-over.',
    'conflict',
  );
  for (const session of [desk, viewer, agent]) {
    const result = await decide(session, handover.id, 'accept');
    const status = session === desk ? 403 : 404;
    assert.equal(result.status, status, JSON.stringify(result.value));
  }
  refused(await decide(second, UNKNOWN, 'accept'), 404, M.missing.message, M.missing.code);
  const declined = await decide(second, handover.id, 'decline');
  assert.equal(declined.value.handover.status, 'declined');
  refused(await decide(second, handover.id, 'accept'), 409, M.notPending, 'conflict');
  assert.equal((await overview(agent, admin)).deals[0].assignee.id, agent.user.id);
});

test('accepting moves the deal and keeps a referral taken from the receiver (H-F1)', async () => {
  const { agent, second, admin } = teams;
  const made = await offer(agent, deal, second.user.id, 1500);
  const accepted = await decide(second, made.value.handover.id, 'accept');
  assert.equal(accepted.status, 200, JSON.stringify(accepted.value));
  assert.equal(accepted.value.handover.status, 'accepted');
  assert.equal(accepted.value.entry.assignee.id, second.user.id);
  assert.deepEqual(accepted.value.entry.secondAgent, { name: agent.user.name });
  const moved = events(deal.id).at(-1);
  assert.equal(moved.action, 'assigned');
  assert.equal(moved.actor, second.user.id);
  assert.equal(moved.reason, 'Hand-over accepted by the receiving agent.');
  assert.deepEqual(moved.changes, {
    assignee: [agent.user.id, second.user.id],
    requestedBy: [null, agent.user.id],
    secondAgentId: [null, agent.user.id],
    secondAgentShareBp: [null, 1500],
  });
  const reasons = query(`SELECT string_agg(reason, ',' ORDER BY created_at) FROM crm_assignments
    WHERE record_id='${deal.id}'`);
  assert.equal(reasons, 'created,handover');
  const earned = await earnDeal(admin, accepted.value.entry);
  const team = (await overview(admin)).deals.find((d) => d.id === earned.id);
  assert.equal(team.secondAgent.kind, 'referral');
  assert.deepEqual(
    team.calculation.lines.map((line) => [line.role, line.agent.id, line.amountFils]),
    [
      ['primary', second.user.id, 2_082_500],
      ['second', agent.user.id, 367_500],
    ],
  );
  assert.equal(team.calculation.companyFils, 2_450_000, 'the company share is untouched');
  deal = earned;
});

test('requesters cancel; the Admin approves or adjusts a referral with a reason', async () => {
  const { agent, second, admin, approver } = teams;
  const other = await createDeal(agent, client);
  const first = await offer(agent, other, second.user.id, 2000);
  const cancelled = await decide(agent, first.value.handover.id, 'cancel');
  assert.equal(cancelled.value.handover.status, 'cancelled');
  const again = await offer(agent, other, second.user.id, 2000);
  const id = again.value.handover.id;
  refused(
    await decide(approver, id, 'approve', { referralShareBp: 1000, reason: 'x' }),
    403,
    M.manage,
    'forbidden',
  );
  refused(
    await decide(admin, id, 'approve', { referralShareBp: 1000 }),
    400,
    'Provide a referral share or null, and a reason.',
    'invalid_request',
  );
  refused(
    await decide(admin, id, 'approve', { referralShareBp: 1000, reason: '' }),
    400,
    M.reason,
    'invalid_request',
  );
  const approved = await decide(admin, id, 'approve', {
    referralShareBp: 1000,
    reason: 'Synthetic adjust',
  });
  assert.equal(approved.status, 200, JSON.stringify(approved.value));
  assert.equal(approved.value.handover.status, 'approved');
  assert.equal(approved.value.handover.referralShareBp, 1000);
  assert.equal(approved.value.entry.secondAgent.shareBp, 1000);
  assert.equal(events(other.id).at(-1).reason, 'Synthetic adjust');
});
