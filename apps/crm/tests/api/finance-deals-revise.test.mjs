import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { day, events, financePath, refused } from './finance-helpers.mjs';
import { DEAL_MESSAGES as M, createDeal, dealBody, dealPath } from './finance-deals-helpers.mjs';
import { dealTeams, earnDeal, heldClient, overview, post } from './finance-deals-helpers.mjs';

let teams, client, agreement, deal;
before(async () => {
  teams = await dealTeams('fin-rev');
  const { admin, agent } = teams;
  const created = await admin.request(financePath(admin, '/agreements'), {
    method: 'POST',
    body: { agentId: agent.user.id, agentShareBp: 6000, effectiveFrom: day(-200) },
  });
  agreement = created.value.agreement;
  client = await heldClient(agent);
  deal = await earnDeal(admin, await createDeal(agent, client));
});

const patch = (session, changes, version = deal.version) =>
  session.request(dealPath(teams.admin, `/${deal.id}`), {
    method: 'PATCH',
    body: { version, deal: dealBody(client, { stage: 'Completed', ...changes }) },
  });
const snapshots = () =>
  query(`SELECT string_agg(revision || ':' || (superseded_at IS NULL), ',' ORDER BY revision)
    FROM crm_deal_snapshots WHERE deal_id='${deal.id}'`);

test('earned money terms are Admin-only and Lost needs an unearn first', async () => {
  const { agent, admin } = teams;
  refused(await patch(agent, { agreedValueFils: 1 }), 403, M.locked, 'forbidden');
  const notes = await patch(agent, { details: { notes: 'Synthetic follow-up' } });
  assert.equal(notes.status, 200, JSON.stringify(notes.value));
  deal = notes.value.deal;
  refused(await patch(agent, { stage: 'Lost' }), 409, M.unearnFirst, 'conflict');
  const echoed = await patch(admin, { dealId: 'DL-999' });
  refused(echoed, 400, 'Deal IDs cannot be changed.', 'invalid_request');
  const money = await patch(admin, { agreedValueFils: 300_000_000 });
  assert.equal(money.status, 200, JSON.stringify(money.value));
  deal = money.value.deal;
  assert.equal(deal.agreedValueFils, 300_000_000);
  assert.equal(deal.calculation.netFils, 4_900_000, 'the snapshot is unchanged until revised');
  assert.equal(snapshots(), '1:true');
});

test('reassigning keeps lines; revise keeps the primary agent and agreement (M-F3)', async () => {
  const { admin, agent, second } = teams;
  const moved = await admin.request(dealPath(admin, `/${deal.id}/assignee`), {
    method: 'PUT',
    body: { version: deal.version, assigneeId: second.user.id, reason: 'Synthetic cover' },
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.value));
  deal = moved.value.entry;
  assert.equal(deal.assignee.id, second.user.id);
  const statement = (await overview(agent, admin)).statement.lines;
  assert.deepEqual(
    statement.map((line) => [line.dealId, line.amountFils]),
    [[deal.dealId, 2_940_000]],
  );
  refused(
    await post(admin, admin, deal.id, 'revise', { version: deal.version }),
    400,
    'Provide a version, a reason and any split changes.',
    'invalid_request',
  );
  const revised = await post(admin, admin, deal.id, 'revise', {
    version: deal.version,
    reason: 'Synthetic correction',
  });
  assert.equal(revised.status, 200, JSON.stringify(revised.value));
  const { before: was, after } = revised.value;
  assert.deepEqual([was.revision, after.revision], [1, 2]);
  assert.equal(after.netFils, 6_000_000);
  assert.equal(after.agreementId, agreement.id);
  assert.deepEqual(
    after.lines.map((line) => [line.role, line.agent.id, line.amountFils]),
    [['primary', agent.user.id, 3_600_000]],
  );
  deal = revised.value.deal;
  assert.equal(snapshots(), '1:false,2:true');
  const back = await admin.request(financePath(admin, '/agreements'), {
    method: 'POST',
    body: { agentId: agent.user.id, agentShareBp: 7000, effectiveFrom: day(-10) },
  });
  refused(back, 409, M.earnedAgreement, 'conflict');
  const changed = await post(admin, admin, deal.id, 'revise', {
    version: deal.version,
    reason: 'Synthetic primary change',
    primaryAgentId: second.user.id,
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.value));
  assert.equal(changed.value.after.splitSource, 'team_default');
  assert.equal(changed.value.after.lines[0].agent.id, second.user.id);
  deal = changed.value.deal;
  const actions = events(deal.id).map((event) => event.action);
  assert.deepEqual(actions.slice(-4), ['updated', 'assigned', 'revised', 'revised']);
});

test('unearn needs a reason and no approved payments; re-earning continues the revisions', async () => {
  const { admin } = teams;
  const unearn = (body) => post(admin, admin, deal.id, 'unearn', body);
  refused(
    await unearn({ version: deal.version }),
    400,
    'Provide a version and a reason.',
    'invalid_request',
  );
  const done = await unearn({ version: deal.version, reason: 'Synthetic cancellation' });
  assert.equal(done.status, 200, JSON.stringify(done.value));
  deal = done.value.deal;
  assert.equal(deal.earnedOn, null);
  assert.equal(deal.calculation.preview, true);
  assert.equal(snapshots(), '1:false,2:false,3:false');
  refused(await unearn({ version: deal.version, reason: 'Again' }), 409, M.notEarned, 'conflict');
  const revise = await post(admin, admin, deal.id, 'revise', {
    version: deal.version,
    reason: 'x',
  });
  refused(revise, 409, M.notEarned, 'conflict');
  deal = await earnDeal(admin, deal);
  assert.equal(deal.calculation.revision, 4, 'max(revision)+1');
  const removed = await admin.request(dealPath(admin, `/${deal.id}`), {
    method: 'DELETE',
    body: { version: deal.version },
  });
  refused(removed, 409, M.everEarned, 'conflict');
});

test('only the Admin deletes never-earned deals, with history', async () => {
  const { admin, agent } = teams;
  const fresh = await createDeal(agent, client);
  const remove = (session, version) =>
    session.request(dealPath(admin, `/${fresh.id}`), { method: 'DELETE', body: { version } });
  refused(await remove(agent, 1), 403, M.manage, 'forbidden');
  refused(await remove(admin, 2), 409, M.stale, 'version_conflict');
  const gone = await remove(admin, 1);
  assert.deepEqual(gone.value, { deleted: fresh.id });
  refused(await remove(admin, 1), 404, M.missing.message, M.missing.code);
  assert.deepEqual(
    events(fresh.id).map((event) => event.action),
    ['created', 'deleted'],
  );
});
