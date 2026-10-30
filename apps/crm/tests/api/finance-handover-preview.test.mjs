import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { UNKNOWN, createDeal, heldClient } from './finance-deals-helpers.mjs';
import {
  accept,
  decide,
  notFound,
  offered,
  preview,
  reviewTeams,
  withoutApprove,
} from './finance-handover-helpers.mjs';

// Who may open a hand-over's review preview (agreements design §17, H2 amendment 9).
let teams;
before(async () => {
  teams = await reviewTeams('h2-peek');
});

async function opens(session, handover, label) {
  const shown = await preview(session, teams.admin, handover.id);
  assert.equal(shown.status, 200, `${label} ${JSON.stringify(shown.value)}`);
  assert.equal(shown.value.handover.id, handover.id, label);
}

const fresh = (options) =>
  heldClient(teams.agent)
    .then((client) => createDeal(teams.agent, client))
    .then((deal) => offered(teams.admin, teams.agent, deal, teams.second, options));

// Each deal gets its own client: an accepted hand-over moves the client (§18).
test('the receiver and the Admin review a pending offer; everyone else gets one 404', async () => {
  const { admin, second, agent, third, viewer, approver, backup, owner, other, desk } = teams;
  const handover = await fresh({ approver: backup });
  await opens(second, handover, 'receiver');
  await opens(admin, handover, 'Admin');
  for (const [who, label] of [
    [agent, 'holder'],
    [third, 'another agent'],
    [viewer, 'team-view staff'],
    [approver, 'an approver not chosen'],
    [backup, 'the chosen approver before the acceptance'],
    [owner, 'Super Admin'],
  ]) {
    notFound(await preview(who, admin, handover.id), label);
  }
  const home = other.user.workspaceId;
  notFound(await preview(other, admin, handover.id, home), "another company's Admin");
  assert.equal((await preview(other, admin, handover.id)).status, 403, 'not their company');
  assert.equal((await preview(desk, admin, handover.id)).status, 403, 'no finance module');
  notFound(await preview(admin, admin, UNKNOWN), 'unknown ID');
  notFound(await preview(admin, admin, 'not-a-hand-over'), 'malformed ID');
});

test('decided requests are hidden from everyone, the Admin included', async () => {
  const { admin, agent, second } = teams;
  const declined = await fresh();
  assert.equal((await decide(second, admin, declined, 'decline')).status, 200);
  const cancelled = await fresh();
  assert.equal((await decide(agent, admin, cancelled, 'cancel')).status, 200);
  const accepted = await fresh();
  assert.equal((await accept(second, admin, accepted)).status, 200);
  for (const handover of [declined, cancelled, accepted]) {
    for (const who of [admin, second, agent]) {
      notFound(await preview(who, admin, handover.id), `${handover.id} ${who.user.email}`);
    }
  }
});

test('while an acceptance waits, the approver reviews it only while holding Approve', async () => {
  const { admin, agent, second, third, viewer, approver, backup, owner } = teams;
  const handover = await fresh({ approver: backup });
  const accepted = await accept(second, admin, handover);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.value));
  assert.equal(accepted.value.handover.status, 'awaiting_approval');
  await opens(backup, handover, 'the chosen approver');
  await opens(admin, handover, 'Admin');
  await opens(second, handover, 'the receiver, still eligible (amendment 9)');
  for (const [who, label] of [
    [agent, 'holder'],
    [third, 'another agent'],
    [viewer, 'team-view staff'],
    [approver, 'an approver not chosen'],
    [owner, 'Super Admin'],
  ]) {
    notFound(await preview(who, admin, handover.id), label);
  }
  const demoted = await withoutApprove(admin, backup);
  notFound(await preview(demoted, admin, handover.id), 'the approver without Approve');
  await opens(admin, handover, 'the Admin keeps the request (amendment 14)');
});
