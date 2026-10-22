import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { refused } from './finance-helpers.mjs';
import { createDeal, dealTeams, heldClient } from './finance-deals-helpers.mjs';
import { command, terms } from './agreements-helpers.mjs';
import {
  HANDOVER,
  KIND_FIXED,
  RELOAD,
  decide,
  offer,
  orphans,
  read,
  stored,
} from './agreements-handover-helpers.mjs';

let teams, client;
before(async () => {
  teams = await dealTeams('agr-hand', { maxReferralShareBp: 2500 });
  client = await heldClient(teams.agent);
});

test('an offer becomes a sent in-company agreement with server-built terms', async () => {
  const { admin, agent, second, desk, viewer, other } = teams;
  const handover = await offer(admin, agent, await createDeal(agent, client), second, 2000);
  assert.match(handover.agreementId, /^[0-9a-f-]{36}$/);
  const shown = await read(second, admin, handover);
  assert.equal(shown.status, 200, JSON.stringify(shown.value));
  const { agreement, revision } = shown.value;
  assert.deepEqual(
    [agreement.origin, agreement.kind, agreement.state, agreement.version],
    ['deal_handover', 'handover_referral', 'sent', 2],
  );
  assert.equal(agreement.senderWorkspaceId, agreement.recipientWorkspaceId);
  const { money, subject } = revision.terms;
  assert.deepEqual(money, {
    basis: 'agent_commission',
    amountFils: 4_900_000,
    senderShareBp: 2000,
    recipientShareBp: 8000,
    paymentExpectation: 'on_receipt',
  });
  assert.deepEqual(subject, {
    client: { displayName: 'Synthetic C.', contact: null },
    property: null,
  });
  assert.equal((await read(admin, admin, handover)).status, 200, 'the Admin reads it');
  // Staff outside the hand-over see nothing; another company cannot even open this one.
  for (const [outsider, status] of [
    [desk, 404],
    [viewer, 404],
    [other, 403],
  ]) {
    assert.equal((await read(outsider, admin, handover)).status, status, outsider.user.email);
  }
  const listed = await second.request(`/workspaces/${admin.user.workspaceId}/agreements`);
  assert.ok(listed.value.agreements.some((item) => item.id === handover.agreementId));
  assert.equal(listed.value.referralCapBp, 2500);
});

test('the agreement routes refuse hand-overs; only Deals moves them', async () => {
  const { admin, agent, second } = teams;
  const handover = await offer(admin, agent, await createDeal(agent, client), second);
  const id = handover.agreementId;
  for (const [who, name, extra] of [
    [second, 'accept'],
    [second, 'decline'],
    [second, 'counter', { terms: terms() }],
    [agent, 'revoke'],
    [agent, 'send'],
  ]) {
    const refusal = await command(who, id, name, { expectedVersion: 2, ...extra });
    refused(refusal, 409, HANDOVER, 'conflict', name);
  }
  const edited = await agent.request(`/workspaces/${admin.user.workspaceId}/agreements/${id}`, {
    method: 'PATCH',
    body: { expectedVersion: 2, terms: terms() },
  });
  refused(edited, 409, HANDOVER, 'conflict', 'edit');
  assert.equal(stored(handover), 'sent|sent|sender');
});

test('the receiver accepts exactly the version they were shown', async () => {
  const { admin, agent, second } = teams;
  const handover = await offer(admin, agent, await createDeal(agent, client), second, 1500);
  refused(await decide(second, admin, handover, 'accept'), 400, RELOAD, 'invalid_request');
  const stale = await decide(second, admin, handover, 'accept', { agreementVersion: 1 });
  assert.equal(stale.status, 409, JSON.stringify(stale.value));
  const accepted = await decide(second, admin, handover, 'accept', { agreementVersion: 2 });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.value));
  assert.equal(stored(handover), 'accepted|accepted|recipient');
  const action = query(`SELECT x.verification||'|'||(x.accepted_digest=r.digest)::text
    FROM agreements.crm_agreement_actions x JOIN agreements.crm_agreement_revisions r
    ON r.id=x.revision_id WHERE x.agreement_id='${handover.agreementId}'`);
  assert.equal(action, 'member|true');
});

test('an Admin approval is recorded as itself, with any new share as an Admin revision', async () => {
  const { admin, agent, second } = teams;
  const deal = await createDeal(agent, client);
  const handover = await offer(admin, agent, deal, second, 2000);
  const approve = (body) => decide(admin, admin, handover, 'approve', body);
  const asFull = { referralShareBp: null, reason: 'Synthetic', agreementVersion: 2 };
  refused(await approve(asFull), 409, KIND_FIXED, 'conflict');
  const adjusted = await approve({ ...asFull, referralShareBp: 1000 });
  assert.equal(adjusted.status, 200, JSON.stringify(adjusted.value));
  const shown = (await read(second, admin, handover)).value;
  assert.equal(shown.agreement.state, 'accepted');
  assert.equal(shown.revision.authorParty, 'admin');
  assert.equal(shown.revision.terms.money.senderShareBp, 1000);
  const action = query(`SELECT action||'|'||verification||'|'||party||'|'||actor_id
    FROM agreements.crm_agreement_actions WHERE agreement_id='${handover.agreementId}'`);
  assert.equal(action, `approved|admin_decision|recipient|${admin.user.id}`);
  assert.equal(stored(handover), 'accepted|approved|-');
});

test('declines and cancels close the agreement with the right party', async () => {
  const { admin, agent, second } = teams;
  const offerAgain = async () => offer(admin, agent, await createDeal(agent, client), second);
  const [declined, cancelled, adminDeclined] = [
    await offerAgain(),
    await offerAgain(),
    await offerAgain(),
  ];
  assert.equal((await decide(second, admin, declined, 'decline')).status, 200);
  assert.equal(stored(declined), 'declined|declined|recipient');
  assert.equal((await decide(agent, admin, cancelled, 'cancel')).status, 200);
  assert.equal(stored(cancelled), 'revoked|revoked|sender');
  assert.equal((await decide(admin, admin, adminDeclined, 'decline')).status, 200);
  assert.equal(stored(adminDeclined), 'revoked|revoked|-');
  assert.equal(orphans(), '0');
});
