import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { day, events, refused } from './finance-helpers.mjs';
import { DEAL_MESSAGES as M, createDeal, dealPath, dealTeams } from './finance-deals-helpers.mjs';
import { heldClient, post, seen } from './finance-deals-helpers.mjs';

let teams, client;
before(async () => {
  teams = await dealTeams('fin-earn');
  client = await heldClient(teams.agent);
});

const earn = (session, deal, earnedOn = day(0)) =>
  post(session, teams.admin, deal.id, 'earn', { version: deal.version, earnedOn });
const assign = (deal, assigneeId) =>
  teams.admin.request(dealPath(teams.admin, `/${deal.id}/assignee`), {
    method: 'PUT',
    body: { version: deal.version, assigneeId, reason: 'Synthetic move' },
  });

test('earning needs team settings, a past date and a live deal', async () => {
  const otherClient = await heldClient(teams.other);
  const unset = await createDeal(teams.other, otherClient);
  const body = { version: unset.version, earnedOn: day(0) };
  const result = await post(teams.other, teams.other, unset.id, 'earn', body);
  refused(result, 409, M.noSettings, 'conflict');
  const deal = await createDeal(teams.agent, client);
  refused(await earn(teams.approver, deal, day(1)), 400, M.future, 'invalid_request');
  refused(await earn(teams.agent, deal, day(1)), 403, M.approve, 'forbidden', '403 first');
  refused(await earn(teams.approver, { ...deal, version: 9 }), 409, M.stale, 'version_conflict');
  const lost = await createDeal(teams.agent, client, { stage: 'Lost' });
  refused(await earn(teams.approver, lost), 409, M.lost, 'conflict');
});

test('staff approvers never earn deals they hold, share or handed on (H-F1, M-F2)', async () => {
  const { admin, approver, agent } = teams;
  const held = (await assign(await createDeal(agent, client), approver.user.id)).value.entry;
  refused(await earn(approver, held), 403, M.own, 'forbidden', 'holder');
  const shared = await createDeal(agent, client);
  const split = await admin.request(dealPath(admin, `/${shared.id}/split`), {
    method: 'PUT',
    body: {
      version: 1,
      secondAgentId: approver.user.id,
      secondAgentShareBp: 1000,
      overrideAgentShareBp: null,
      reason: 'Synthetic',
    },
  });
  assert.equal(split.status, 200, JSON.stringify(split.value));
  refused(await earn(approver, split.value.deal), 403, M.own, 'forbidden', 'second agent');
  const handed = await post(approver, admin, held.id, 'handovers', {
    version: held.version,
    toId: agent.user.id,
    referralShareBp: null,
  });
  assert.equal(handed.status, 201, JSON.stringify(handed.value));
  const accept = `/workspaces/${admin.user.workspaceId}/finance/handovers`;
  const accepted = await agent.request(`${accept}/${handed.value.handover.id}/accept`, {
    method: 'POST',
    body: await seen(agent, admin, handed.value.handover),
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.value));
  const moved = accepted.value.entry;
  assert.equal(moved.allowed.earn, false);
  refused(await earn(approver, moved), 403, M.own, 'forbidden', 'handed on since last earn');
  const fresh = await createDeal(agent, client);
  refused(await earn(approver, fresh, day(-40)), 403, M.range, 'forbidden', '31 days');
  refused(await earn(approver, fresh, day(-1)), 403, M.range, 'forbidden', 'before created');
  const old = await earn(admin, fresh, day(-40));
  assert.equal(old.status, 200, 'Admins may backdate');
});

test('an approver earns: snapshot, Completed stage, history and name-only activity', async () => {
  const { approver, agent } = teams;
  const deal = await createDeal(agent, client, { stage: 'Documentation' });
  const result = await earn(approver, deal);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  const earned = result.value.deal;
  assert.equal(earned.stage, 'Completed');
  assert.equal(earned.earnedOn, day(0));
  assert.equal(earned.calculation.preview, false);
  assert.equal(earned.calculation.revision, 1);
  assert.equal(earned.calculation.splitSource, 'team_default');
  assert.deepEqual(result.value.warnings, []);
  const history = events(deal.id).map((event) => [event.action, event.actor]);
  assert.deepEqual(history, [
    ['created', agent.user.id],
    ['earned', approver.user.id],
  ]);
  assert.deepEqual(events(deal.id)[1].changes, {
    earnedOn: [null, day(0)],
    stage: ['Documentation', 'Completed'],
    revision: [null, 1],
    splitSource: [null, 'team_default'],
    netFils: [null, 4_900_000],
  });
  const activity = query(`SELECT string_agg(action, ',' ORDER BY created_at) FROM crm_activity
    WHERE record_id='${deal.id}' AND collection='Deals'`);
  assert.equal(activity, 'created,earned');
  refused(await earn(approver, earned), 409, M.already, 'conflict');
  const split = await teams.admin.request(dealPath(teams.admin, `/${deal.id}/split`), {
    method: 'PUT',
    body: {
      version: earned.version,
      secondAgentId: null,
      secondAgentShareBp: null,
      overrideAgentShareBp: 9000,
      reason: 'Synthetic',
    },
  });
  refused(split, 409, M.revise, 'conflict');
});

test('the earn preview shows the agreement, source and lines without writing', async () => {
  const deal = await createDeal(teams.agent, client);
  const path = dealPath(teams.admin, `/${deal.id}/earn-preview?earnedOn=${day(0)}`);
  const result = await teams.approver.request(path);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  const { preview } = result.value;
  assert.equal(preview.agreement, null);
  assert.equal(preview.calculation.splitSource, 'team_default');
  assert.deepEqual(
    preview.calculation.lines.map((line) => [line.role, line.amountFils]),
    [['primary', 2_450_000]],
  );
  assert.equal(query(`SELECT count(*) FROM crm_deal_snapshots WHERE deal_id='${deal.id}'`), '0');
});
