import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { events, financePath, refused } from './finance-helpers.mjs';
import { DEAL_MESSAGES as M, createDeal, dealPath, dealTeams } from './finance-deals-helpers.mjs';
import { earnDeal, heldClient, overview, post, seen } from './finance-deals-helpers.mjs';

let teams, client;
before(async () => {
  teams = await dealTeams('fin-assign', { maxReferralShareBp: 3000 });
  client = await heldClient(teams.agent);
});

const move = (session, deal, assigneeId, reason = 'Synthetic move') =>
  session.request(dealPath(teams.admin, `/${deal.id}/assignee`), {
    method: 'PUT',
    body: { version: deal.version, assigneeId, reason },
  });

test('Admin moves need a reason and an eligible holder; the queue is Admin-only', async () => {
  const { admin, agent, second, desk, viewer } = teams;
  const deal = await createDeal(agent, client);
  refused(await move(viewer, deal, second.user.id), 403, M.manage, 'forbidden');
  refused(await move(admin, deal, second.user.id, ''), 400, M.reason, 'invalid_request');
  refused(await move(admin, deal, desk.user.id), 400, M.ineligible, 'invalid_request');
  const pending = await post(agent, admin, deal.id, 'handovers', {
    version: deal.version,
    toId: second.user.id,
    referralShareBp: null,
  });
  assert.equal(pending.status, 201);
  const queued = await move(admin, deal, null, 'Synthetic queue');
  assert.equal(queued.status, 200, JSON.stringify(queued.value));
  assert.equal(queued.value.entry.assignee, null);
  const handover = query(`SELECT status FROM crm_deal_handovers
    WHERE id='${pending.value.handover.id}'`);
  assert.equal(handover, 'cancelled', 'an Admin move cancels pending hand-overs');
  assert.deepEqual((await overview(agent, admin)).deals, [], 'the agent no longer sees it');
  const back = await move(admin, queued.value.entry, agent.user.id, 'Synthetic return');
  assert.equal(back.value.entry.assignee.id, agent.user.id);
  const moves = events(deal.id).filter((e) => e.action === 'assigned');
  assert.deepEqual(
    moves.map((e) => [e.changes.assignee, e.reason, e.actor]),
    [
      [[agent.user.id, null], 'Synthetic queue', admin.user.id],
      [[null, agent.user.id], 'Synthetic return', admin.user.id],
    ],
  );
  const owner = await move(admin, back.value.entry, admin.user.id);
  assert.equal(owner.value.entry.calculation.splitSource, 'owner', 'owner-held: no agent lines');
  assert.deepEqual(owner.value.entry.calculation.lines, []);
});

test('Admin-created deals go to the client holder; staff create only on held clients', async () => {
  const { admin, agent, second } = teams;
  assert.equal((await createDeal(admin, client)).assignee.id, agent.user.id);
  const records = `/workspaces/${admin.user.workspaceId}/records/Clients`;
  const own = await admin.request(records, { method: 'POST', body: { record: {} } });
  const owned = await createDeal(admin, own.value.record.client_id);
  assert.equal(owned.assignee.id, admin.user.id, "the Admin holds their own client's deal");
  const queued = await admin.request(`${records}/${own.value.id}/assignee`, {
    method: 'PUT',
    body: { version: own.value.version, assigneeId: null },
  });
  assert.equal(queued.status, 200, JSON.stringify(queued.value));
  assert.equal((await createDeal(admin, own.value.record.client_id)).assignee, null, 'queue');
  const body = (clientId, propertyId) => ({
    deal: { clientId, propertyId, dealType: 'Sale', stage: 'New', agreedValueFils: 1 },
  });
  const create = (clientId, propertyId = null) =>
    second.request(dealPath(admin), {
      method: 'POST',
      body: {
        deal: {
          ...body(clientId, propertyId).deal,
          feeBasis: 'fixed',
          fixedFeeFils: 0,
          details: {},
        },
      },
    });
  const colleague = await create(client);
  refused(colleague, 409, M.client, 'link_missing', "a colleague's client looks missing");
  assert.deepEqual((await create('CL-404')).value, colleague.value);
  const mine = await heldClient(second);
  refused(await create(mine, 'PR-404'), 409, M.property, 'link_missing');
  assert.equal((await create(mine)).status, 201);
});

test('earned deals hand over fully only, and their lines never change', async () => {
  const { admin, agent, second } = teams;
  const earned = await earnDeal(admin, await createDeal(agent, client));
  const handover = (referralShareBp) =>
    post(agent, admin, earned.id, 'handovers', {
      version: earned.version,
      toId: second.user.id,
      referralShareBp,
    });
  refused(await handover(1000), 409, M.revise, 'conflict');
  const full = await handover(null);
  assert.equal(full.status, 201, JSON.stringify(full.value));
  const id = full.value.handover.id;
  const accepted = await second.request(financePath(admin, `/handovers/${id}/accept`), {
    method: 'POST',
    body: await seen(second, admin, full.value.handover),
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.value));
  assert.deepEqual(accepted.value.entry.calculation.lines, [], 'not their line');
  const team = (await overview(admin)).deals.find((d) => d.id === earned.id);
  assert.deepEqual(
    team.calculation.lines.map((line) => line.agent.id),
    [agent.user.id],
  );
});

test('GET /finance/assignees needs hand-on or team finance and lists finance members', async () => {
  const path = financePath(teams.admin, '/assignees');
  refused(await teams.desk.request(path), 403, M.denied, 'forbidden');
  const listed = await teams.agent.request(path);
  assert.equal(listed.status, 200, JSON.stringify(listed.value));
  const ids = listed.value.assignees.map((member) => member.id);
  assert.ok(ids.includes(teams.admin.user.id) && ids.includes(teams.second.user.id));
  assert.ok(!ids.includes(teams.desk.user.id), 'no finance module');
  assert.deepEqual(Object.keys(listed.value.assignees[0]).sort(), ['id', 'kind', 'name']);
  assert.equal(listed.value.assignees.find((m) => m.id === teams.admin.user.id).kind, 'owner');
});
