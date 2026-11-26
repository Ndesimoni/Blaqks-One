import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';
import { refused, settingsBody } from './finance-helpers.mjs';
import { createDeal, dealBody, dealPath, dealTeams, heldClient } from './finance-deals-helpers.mjs';
import { createAgreement, terms } from './agreements-helpers.mjs';
import { EXPIRED, FROZEN, decide, offer, orphans, stored } from './agreements-handover-helpers.mjs';

let teams, client;
before(async () => {
  teams = await dealTeams('agr-close', { maxReferralShareBp: 2500 });
  client = await heldClient(teams.agent);
});

test('moving or deleting the deal, or the receiver leaving, withdraws the offer', async () => {
  const { admin, agent, second } = teams;
  const moved = await createDeal(agent, client);
  const movedOffer = await offer(admin, agent, moved, second);
  const move = await admin.request(dealPath(admin, `/${moved.id}/assignee`), {
    method: 'PUT',
    body: { version: moved.version, assigneeId: null, reason: 'Synthetic move' },
  });
  assert.equal(move.status, 200, JSON.stringify(move.value));
  assert.equal(stored(movedOffer), 'revoked|revoked|-');
  const doomed = await createDeal(agent, client);
  const doomedOffer = await offer(admin, agent, doomed, second);
  const removed = await admin.request(dealPath(admin, `/${doomed.id}`), {
    method: 'DELETE',
    body: { version: doomed.version },
  });
  assert.equal(removed.status, 200, JSON.stringify(removed.value));
  assert.equal(stored(doomedOffer), 'revoked|revoked|-');
  const leaving = await offer(admin, agent, await createDeal(agent, client), second);
  const member = await findMember(admin, second.user.id);
  const left = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { active: false }),
  });
  assert.equal(left.status, 200, JSON.stringify(left.value));
  assert.equal(stored(leaving), 'revoked|revoked|-');
  assert.equal(orphans(), '0');
});

test('an expired offer can only be cancelled', async () => {
  const { admin, agent, approver } = teams;
  const handover = await offer(admin, agent, await createDeal(agent, client), approver);
  query(`UPDATE agreements.crm_agreements SET expires_at=now()-interval '1 minute',
    version=version+1 WHERE id='${handover.agreementId}'`);
  const seen = { agreementVersion: 3 };
  refused(await decide(approver, admin, handover, 'accept', seen), 409, EXPIRED, 'conflict');
  refused(await decide(approver, admin, handover, 'decline'), 409, EXPIRED, 'conflict');
  refused(await decide(admin, admin, handover, 'decline'), 409, EXPIRED, 'conflict');
  const approve = { referralShareBp: null, reason: 'Synthetic', agreementVersion: 3 };
  refused(await decide(admin, admin, handover, 'approve', approve), 409, EXPIRED, 'conflict');
  assert.equal((await decide(agent, admin, handover, 'cancel')).status, 200);
  assert.equal(stored(handover), 'revoked|revoked|sender');
});

test('a pending offer freezes the fee, client, property and split', async () => {
  const { admin, agent, approver } = teams;
  const held = await createDeal(agent, client);
  await offer(admin, agent, held, approver);
  const edit = (changes) =>
    agent.request(dealPath(admin, `/${held.id}`), {
      method: 'PATCH',
      body: { version: held.version, deal: dealBody(client, changes) },
    });
  refused(await edit({ feeRateBp: 300 }), 409, FROZEN, 'conflict');
  const stage = await edit({ stage: 'Negotiation' });
  assert.equal(stage.status, 200, JSON.stringify(stage.value));
  const split = await admin.request(dealPath(admin, `/${held.id}/split`), {
    method: 'PUT',
    body: {
      version: stage.value.deal.version,
      secondAgentId: null,
      secondAgentShareBp: null,
      overrideAgentShareBp: 6000,
      reason: 'Synthetic',
    },
  });
  refused(split, 409, FROZEN, 'conflict');
});

test('a referral to another company follows the sending company limit', async () => {
  const { admin, other } = teams;
  const referral = (senderShareBp) =>
    createAgreement(admin, other, {
      kind: 'handover_referral',
      terms: terms({
        money: {
          basis: 'commission',
          amountFils: 900_000,
          senderShareBp,
          paymentExpectation: 'on_receipt',
        },
      }),
    });
  refused(
    await referral(3000),
    400,
    "The referral share is above the sending company's limit.",
    'invalid_request',
  );
  assert.equal((await referral(2500)).status, 201);
  const save = settingsBody({ version: 1, maxReferralShareBp: 0 });
  const zero = await admin.request(`/workspaces/${admin.user.workspaceId}/finance/settings`, {
    method: 'PUT',
    body: save,
  });
  assert.equal(zero.status, 200, JSON.stringify(zero.value));
  const unset = await referral(100);
  assert.match(unset.value.message, /has not set a referral limit/);
});
