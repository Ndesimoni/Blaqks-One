import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';
import { createDeal, heldClient } from './finance-deals-helpers.mjs';
import { accept, financeStaff, offered, reviewTeams } from './finance-handover-helpers.mjs';
import { richDeal } from './finance-handover-fixtures.mjs';
import {
  badge,
  conversation,
  conversationHolder,
  holderOf,
} from './finance-handover-records-helpers.mjs';
import { keepsOf, listed, refusesEdit, seenAs } from './finance-handover-records-helpers.mjs';

// H3 (agreements design §18): the client and the property go with the deal; the sender
// keeps a read-only view with a badge; a listing other deals use is shared instead.
let teams;
before(async () => {
  teams = await reviewTeams('h3-move');
});

const party = (session) => ({ id: session.user.id, name: session.user.name });
const lastReason = (record) =>
  query(`SELECT reason FROM crm_assignments WHERE record_id='${record.id}'
    ORDER BY created_at DESC LIMIT 1`);

test('accepting moves the client, its conversations and the property; the sender keeps them read-only', async () => {
  const { admin, agent, second } = teams;
  const { deal, client, property } = await richDeal(agent);
  const thread = conversation(agent, client);
  const handover = await offered(admin, agent, deal, second);
  const accepted = await accept(second, admin, handover);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.value));
  assert.deepEqual(accepted.value.records, { client: 'moved', property: 'moved' });
  for (const record of [client, property]) {
    assert.equal(holderOf(record), second.user.id);
    assert.equal(lastReason(record), 'handover');
  }
  assert.equal(conversationHolder(thread), second.user.id, 'the receiver gets the replies');
  const mine = await listed(second);
  const row = mine.records.Clients.find((entry) => entry.id === client.id);
  assert.deepEqual(
    [row.record.phone, row.record.email],
    ['+971500000302', 'zqx.buyer@example.test'],
  );
  assert.deepEqual(mine.kept, {}, 'the receiver holds them; nothing is kept for them');
  for (const [collection, made] of [
    ['Clients', client],
    ['Properties', property],
  ]) {
    const seen = await seenAs(agent, collection, made.id);
    assert.equal(seen.listed, true, collection);
    assert.deepEqual(badge(seen.kept), {
      ...{ reason: 'handed_over', other: party(second), dealId: deal.dealId },
      ...{ kind: 'full', referralShareBp: null },
    });
    await refusesEdit(agent, collection, made);
  }
});

test('a listing other live deals use stays with the sender and is shared read-only', async () => {
  const { admin, agent, third } = teams;
  const { deal, client, property } = await richDeal(agent);
  const propertyId = property.record.property_id;
  const other = await createDeal(agent, await heldClient(agent), { propertyId });
  assert.ok(other.id);
  const handover = await offered(admin, agent, deal, third, { share: 1500 });
  const accepted = await accept(third, admin, handover);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.value));
  assert.deepEqual(accepted.value.records, { client: 'moved', property: 'shared' });
  assert.equal(holderOf(property), agent.user.id);
  const shared = await seenAs(third, 'Properties', property.id);
  assert.equal(shared.listed, true);
  assert.deepEqual(badge(shared.kept), {
    ...{ reason: 'shared', other: party(agent), dealId: deal.dealId },
    ...{ kind: 'referral', referralShareBp: 1500 },
  });
  await refusesEdit(third, 'Properties', property);
  assert.equal(badge((await seenAs(agent, 'Clients', client.id)).kept).kind, 'referral');
  assert.equal((await seenAs(agent, 'Properties', property.id)).kept, null, 'still the holder');
});

test('declining moves nothing, and a member who leaves loses their keeps', async () => {
  const { admin, second } = teams;
  const leaver = await financeStaff(admin, 'h3-leaver', null);
  const first = await richDeal(leaver);
  const declined = await offered(admin, leaver, first.deal, second);
  const no = await second.request(
    `/workspaces/${admin.user.workspaceId}/finance/handovers/${declined.id}/decline`,
    { method: 'POST' },
  );
  assert.equal(no.status, 200, JSON.stringify(no.value));
  assert.equal(holderOf(first.client), leaver.user.id);
  assert.equal(keepsOf(leaver), '0');
  const handover = await offered(admin, leaver, first.deal, second);
  assert.equal((await accept(second, admin, handover)).status, 200);
  assert.equal(keepsOf(leaver), '2');
  const member = await findMember(admin, leaver.user.id);
  const left = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { active: false }),
  });
  assert.equal(left.status, 200, JSON.stringify(left.value));
  assert.equal(keepsOf(leaver), '0', 'keeps end with the membership');
});
