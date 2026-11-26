import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { createDeal, dealPath, dealTeams, heldClient } from './finance-deals-helpers.mjs';
import {
  DEAL_LINK_MISSING as MISSING,
  createLog,
  dealLinks,
  dealRef,
  foreignDeal,
  patchLog,
  postLog,
} from './finance-deal-links-helpers.mjs';

// Interaction log deal links (finance-design §6.3, §13 L-F7): links resolve only through
// deal_ref and only to deals the caller sees under the finance predicate.
let t, ws, clients, deals;
before(async () => {
  t = await dealTeams('deal-links');
  ws = t.admin.user.id;
  clients = {};
  for (const name of ['agent', 'second', 'admin', 'desk'])
    clients[name] = await heldClient(t[name]);
  deals = { other: await foreignDeal(t.other, ws) };
  for (const name of ['agent', 'second', 'admin']) {
    deals[name] = await createDeal(t[name], clients[name]);
  }
});

const refusedLink = (result, label) => {
  assert.equal(result.status, 409, `${label} ${JSON.stringify(result.value)}`);
  assert.deepEqual(result.value, MISSING, label);
};

test('own-view staff link only deals they hold; hidden and unknown deals are identical', async () => {
  const log = await createLog(t.agent, ws, clients.agent, ` ${deals.agent.dealId} `);
  assert.equal(log.record.deal_id_optional, deals.agent.dealId);
  assert.equal(dealRef(ws, log.record.log_id), deals.agent.dealId);
  const hidden = { second: deals.second, admin: deals.admin, otherTeam: deals.other };
  for (const [label, deal] of Object.entries(hidden)) {
    refusedLink(
      await postLog(t.agent, ws, { client_id: clients.agent, deal_id_optional: deal.dealId }),
      label,
    );
  }
  const unknown = { client_id: clients.agent, deal_id_optional: 'DL-NOT-A-DEAL' };
  refusedLink(await postLog(t.agent, ws, unknown), 'unknown');
  const edited = await patchLog(t.agent, ws, log, { deal_id_optional: deals.second.dealId });
  refusedLink(edited, 'edit to a hidden deal');
  assert.equal(dealRef(ws, log.record.log_id), deals.agent.dealId);
});

test('team finance links any workspace deal but never another team’s', async () => {
  const viewed = await createLog(t.viewer, ws, clients.agent, deals.second.dealId);
  assert.equal(dealRef(ws, viewed.record.log_id), deals.second.dealId);
  const admin = await createLog(t.admin, ws, clients.admin, deals.agent.dealId);
  assert.equal(dealRef(ws, admin.record.log_id), deals.agent.dealId);
  for (const deal of [deals.other.dealId, 'DL-NOT-A-DEAL']) {
    refusedLink(
      await postLog(t.admin, ws, { client_id: clients.admin, deal_id_optional: deal }),
      deal,
    );
  }
  const record = { client_id: clients.admin, dealLinks: [] };
  const reserved = await postLog(t.admin, ws, record);
  assert.equal(reserved.status, 400);
  assert.equal(reserved.value.message, 'Server ownership and publication fields cannot be set.');
});

test('schedule-only staff cannot set deal links but keep or clear existing ones', async () => {
  for (const deal of [deals.admin.dealId, deals.agent.dealId, 'DL-NOT-A-DEAL']) {
    const record = { client_id: clients.desk, deal_id_optional: deal };
    refusedLink(await postLog(t.desk, ws, record), deal);
  }
  // The Admin links a log on the receptionist's client; she sees the log, never the deal.
  const linked = await createLog(t.admin, ws, clients.desk, deals.admin.dealId);
  const logId = linked.record.log_id;
  assert.deepEqual(await dealLinks(t.desk, ws), []);
  const kept = await patchLog(t.desk, ws, linked, { conversation_topic: 'Edited by desk' });
  assert.equal(kept.status, 200, JSON.stringify(kept.value));
  assert.equal(dealRef(ws, logId), deals.admin.dealId);
  const cleared = await patchLog(t.desk, ws, kept.value, { deal_id_optional: '' });
  assert.equal(cleared.status, 200, JSON.stringify(cleared.value));
  assert.equal(dealRef(ws, logId), '-');
  const restored = await patchLog(t.desk, ws, cleared.value, {
    deal_id_optional: deals.admin.dealId,
  });
  refusedLink(restored, 'restore');
  assert.equal(dealRef(ws, logId), '-');
});

test('dealLinks lists only links to deals the caller can already see', async () => {
  const own = await createLog(t.agent, ws, clients.agent, deals.agent.dealId);
  const foreign = await createLog(t.admin, ws, clients.agent, deals.admin.dealId);
  const agentLinks = await dealLinks(t.agent, ws);
  assert.ok(agentLinks.some((link) => link.log_id === own.record.log_id));
  assert.ok(agentLinks.every((link) => link.deal_id === deals.agent.dealId));
  assert.ok(agentLinks.every((link) => Object.keys(link).sort().join() === 'deal_id,log_id'));
  const teamLinks = await dealLinks(t.viewer, ws);
  assert.deepEqual(
    teamLinks.find((link) => link.log_id === foreign.record.log_id),
    { log_id: foreign.record.log_id, deal_id: deals.admin.dealId },
  );
  assert.deepEqual(await dealLinks(t.other, t.other.user.id), []);
});

test('a deal referenced by a log cannot be deleted until the link is cleared', async () => {
  const client = await heldClient(t.admin);
  const deal = await createDeal(t.admin, client);
  const log = await createLog(t.admin, ws, client, deal.dealId);
  const remove = () =>
    t.admin.request(dealPath(t.admin, `/${deal.id}`), {
      method: 'DELETE',
      body: { version: deal.version },
    });
  const blocked = await remove();
  assert.equal(blocked.status, 409);
  assert.deepEqual(blocked.value, {
    message: 'A linked record prevents this change.',
    code: 'conflict',
  });
  const cleared = await patchLog(t.admin, ws, log, { deal_id_optional: null });
  assert.equal(cleared.status, 200, JSON.stringify(cleared.value));
  const removed = await remove();
  assert.equal(removed.status, 200, JSON.stringify(removed.value));
  assert.deepEqual(removed.value, { deleted: deal.id });
});
