import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { createDeal, heldClient, overview } from './finance-deals-helpers.mjs';
import { offered, preview, reviewTeams } from './finance-handover-helpers.mjs';

// The H2 code security review's Low fixes (agreements design §17, "H2 as built").
let teams;
before(async () => {
  teams = await reviewTeams('h2-fix');
});

test('preview dates are dates only; free text in them never shows', async () => {
  const { admin, agent, second } = teams;
  const client = await heldClient(agent);
  const deal = await createDeal(agent, client, {
    details: {
      opened_date: 'Zqx call +971501112233',
      target_close_date: '2026-12-15',
      next_action_due: '15/11/2026 zqx',
    },
  });
  const handover = await offered(admin, agent, deal, second);
  const result = await preview(second, admin, handover.id);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  const { openedDate, targetCloseDate, nextActionDue } = result.value.deal;
  assert.deepEqual(
    { openedDate, targetCloseDate, nextActionDue },
    { openedDate: null, targetCloseDate: '2026-12-15', nextActionDue: null },
  );
  assert.doesNotMatch(JSON.stringify(result.value), /zqx|971501112233/i);
});

test('the Super Admin sees no agreement details of hand-overs in the finance overview', async () => {
  const { admin, agent, second, approver, owner } = teams;
  const client = await heldClient(agent);
  const deal = await createDeal(agent, client);
  const handover = await offered(admin, agent, deal, second, { approver });
  const team = (await overview(admin)).handovers.find((row) => row.id === handover.id);
  assert.ok(team.agreementId && team.expiresAt && team.approval, JSON.stringify(team));
  const seen = (await overview(owner, admin)).handovers.find((row) => row.id === handover.id);
  assert.ok(seen, 'the Super Admin still sees the request itself');
  assert.deepEqual(
    { agreementId: seen.agreementId, expiresAt: seen.expiresAt, approval: seen.approval },
    { agreementId: null, expiresAt: null, approval: null },
  );
});
