import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { day, financePath } from './finance-helpers.mjs';
import { createDeal, dealPath, dealTeams, earnDeal, heldClient } from './finance-deals-helpers.mjs';
import { overview, sortedKeys } from './finance-deals-helpers.mjs';

let teams, earned, open, client;
const OWN_DEAL = [
  ...['agreedValueFils', 'allowed', 'assignee', 'calculation', 'clientId', 'dealId', 'dealType'],
  ...['details', 'earnedOn', 'feeBasis', 'feeRateBp', 'fixedFeeFils', 'id', 'outstandingFils'],
  ...['partnerName', 'partnerShareBp', 'paymentStatus', 'pendingHandover', 'propertyId'],
  ...['receivedFils', 'secondAgent', 'stage', 'version'],
];
const OWN_CALC = ['adjusted', 'grossFils', 'lines', 'netFils', 'partnerFils', 'preview'];
const SECOND_LINE = ['amountFils', 'dealId', 'dealType', 'earnedOn', 'outstandingFils'];

before(async () => {
  teams = await dealTeams('fin-view', { secondAgentSource: 'first_agent' });
  const { admin, agent, second } = teams;
  const agreement = await admin.request(financePath(admin, '/agreements'), {
    method: 'POST',
    body: { agentId: agent.user.id, agentShareBp: 6000, effectiveFrom: day(-200) },
  });
  assert.equal(agreement.status, 201, JSON.stringify(agreement.value));
  client = await heldClient(agent);
  const deal = await createDeal(agent, client);
  const split = await admin.request(dealPath(admin, `/${deal.id}/split`), {
    method: 'PUT',
    body: {
      version: deal.version,
      secondAgentId: second.user.id,
      secondAgentShareBp: 2500,
      overrideAgentShareBp: null,
      reason: 'Synthetic co-listing',
    },
  });
  assert.equal(split.status, 200, JSON.stringify(split.value));
  earned = await earnDeal(admin, split.value.deal);
  open = await createDeal(agent, client, { agreedValueFils: 100_000_000 });
});

test('the holder sees an exact own view: own line only, no company, override or second share', async () => {
  const mine = await overview(teams.agent, teams.admin);
  assert.equal(mine.scope, 'own');
  const deal = mine.deals.find((d) => d.id === earned.id);
  assert.deepEqual(sortedKeys(deal), OWN_DEAL);
  assert.deepEqual(sortedKeys(deal.calculation), [...OWN_CALC, 'revision', 'vatFils'].sort());
  assert.deepEqual(deal.calculation.lines, [{ role: 'primary', amountFils: 2_205_000 }]);
  assert.equal(deal.calculation.netFils, 4_900_000);
  assert.deepEqual(deal.secondAgent, { name: teams.second.user.name });
  assert.equal(deal.paymentStatus, 'outstanding');
  const text = JSON.stringify(mine);
  for (const hidden of ['1960000', '735000', teams.second.user.id, 'Synthetic co-listing']) {
    assert.ok(!text.includes(hidden), hidden);
  }
  assert.ok(!('teamTotals' in mine));
  const line = mine.statement.lines.find((l) => l.dealId === earned.dealId);
  assert.deepEqual(line, {
    dealId: earned.dealId,
    earnedOn: earned.earnedOn,
    dealType: 'Sale',
    role: 'primary',
    shareBp: 6000,
    amountFils: 2_205_000,
    receivedShareFils: 0,
    outstandingFils: 2_205_000,
    adjusted: false,
  });
  const preview = mine.deals.find((d) => d.id === open.id).calculation;
  assert.equal(preview.preview, true);
  assert.deepEqual(preview.lines, [{ role: 'primary', amountFils: 1_200_000 }]);
  assert.deepEqual(mine.references.Clients, [
    { client_id: client, full_name: 'Synthetic finance client' },
  ]);
});

test('a second agent sees only their statement line (M-F5)', async () => {
  const theirs = await overview(teams.second, teams.admin);
  assert.deepEqual(theirs.deals, []);
  assert.equal(theirs.statement.lines.length, 1);
  const [line] = theirs.statement.lines;
  assert.deepEqual(sortedKeys(line), [...SECOND_LINE, 'receivedShareFils', 'role'].sort());
  assert.equal(line.amountFils, 735_000);
  assert.deepEqual(theirs.statement.totals, {
    earnedFils: 735_000,
    receivedShareFils: 0,
    outstandingFils: 735_000,
  });
  const text = JSON.stringify(theirs);
  for (const hidden of ['4900000', '2205000', '1960000', earned.id]) {
    assert.ok(!text.includes(hidden), hidden);
  }
});

test('team views carry company figures, every line and team totals', async () => {
  for (const name of ['admin', 'viewer', 'approver']) {
    const team = await overview(teams[name], teams.admin);
    assert.equal(team.scope, 'team', name);
    const deal = team.deals.find((d) => d.id === earned.id);
    assert.equal(deal.calculation.companyFils, 1_960_000, name);
    assert.equal(deal.calculation.splitSource, 'agreement');
    assert.deepEqual(
      deal.calculation.lines.map((line) => [
        line.role,
        line.agent.id,
        line.shareBp,
        line.amountFils,
      ]),
      [
        ['primary', teams.agent.user.id, 6000, 2_205_000],
        ['second', teams.second.user.id, 2500, 735_000],
      ],
    );
    assert.deepEqual(deal.secondAgent, {
      id: teams.second.user.id,
      name: teams.second.user.name,
      shareBp: 2500,
      kind: 'split',
    });
    assert.equal(deal.override, null);
    assert.equal(team.teamTotals.companyFils, 1_960_000);
    assert.equal(team.teamTotals.vatFils, 245_000);
    assert.equal(team.teamTotals.byAgent.length, 2);
  }
  const approver = await overview(teams.approver, teams.admin);
  assert.deepEqual(approver.references.Clients, [], 'no relationships grant, IDs only');
  const filtered = await overview(teams.admin, teams.admin, `?agent=${teams.second.user.id}`);
  assert.deepEqual(filtered.deals, []);
  assert.equal(filtered.statement.lines[0].amountFils, 735_000);
});
