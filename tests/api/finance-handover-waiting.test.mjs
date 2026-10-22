import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { activate, invite } from './team-helpers.mjs';
import { createDeal, heldClient } from './finance-deals-helpers.mjs';
import { command, createAgreement, sentAgreement, terms } from './agreements-helpers.mjs';
import { accept, agreementsWaiting, counts, decide } from './finance-handover-helpers.mjs';
import {
  expire,
  offered,
  reviewTeams,
  shownVersion,
  waiting,
} from './finance-handover-helpers.mjs';

// The sidebar's waiting counts (agreements design §17 item 2, H2 amendments 15, 17, 18).
let teams;
before(async () => {
  teams = await reviewTeams('h2-wait');
});

const zero = { answer: 0, approve: 0 };
const counted = (...sessions) => Promise.all(sessions.map((s) => counts(s, teams.admin)));
const fresh = (to, options) =>
  heldClient(teams.agent)
    .then((client) => createDeal(teams.agent, client))
    .then((deal) => offered(teams.admin, teams.agent, deal, to, options));

// Each deal gets its own client: an accepted hand-over moves the client (§18).
test('hand-over counts follow each step for the receiver, the approver and the Admin', async () => {
  const { admin, agent, second, approver, viewer, desk, owner } = teams;
  assert.deepEqual(await counted(second, approver, admin, agent), [zero, zero, zero, zero]);
  const plain = await fresh(second);
  const checked = await fresh(second, { approver });
  const toAdmin = await fresh(admin);
  assert.deepEqual(await counted(second, approver, admin, agent), [
    { answer: 2, approve: 0 },
    zero,
    { answer: 1, approve: 0 },
    zero,
  ]);
  assert.equal((await accept(second, admin, checked)).status, 200);
  assert.deepEqual(await counted(second, approver, admin, agent, viewer), [
    { answer: 1, approve: 0 },
    { answer: 0, approve: 1 },
    { answer: 1, approve: 1 },
    zero,
    zero,
  ]);
  const superAdmin = await waiting(owner, admin);
  if (superAdmin.status === 200) assert.deepEqual(superAdmin.value, zero, 'Super Admin');
  else assert.equal(superAdmin.status, 403, JSON.stringify(superAdmin.value));
  assert.equal((await waiting(desk, admin)).status, 403, 'no finance module');
  const version = await shownVersion(approver, admin, checked);
  const approved = await decide(approver, admin, checked, 'approve-acceptance', version);
  assert.equal(approved.status, 200, JSON.stringify(approved.value));
  assert.deepEqual(await counted(second, approver, admin), [
    { answer: 1, approve: 0 },
    zero,
    { answer: 1, approve: 0 },
  ]);
  expire(plain);
  assert.deepEqual(await counts(second, admin), zero, 'an ended offer is not counted');
  const late = await fresh(second, { approver });
  assert.equal((await accept(second, admin, late)).status, 200);
  assert.deepEqual(await counted(approver, admin), [
    { answer: 0, approve: 1 },
    { answer: 1, approve: 1 },
  ]);
  expire(late);
  assert.deepEqual(await counted(approver, admin), [zero, { answer: 1, approve: 0 }]);
  assert.equal((await decide(admin, admin, toAdmin, 'decline')).status, 200);
  assert.deepEqual(await counts(admin, admin), zero);
});

test('agreement counts show offers from other companies to whoever must answer', async () => {
  const { admin, agent, second, other, owner } = teams;
  const theirStaff = await activate(await invite(other, 'h2-wait-theirs'));
  const answers = (...sessions) =>
    Promise.all(
      sessions.map(async (session) => {
        const result = await agreementsWaiting(session);
        assert.equal(result.status, 200, JSON.stringify(result.value));
        assert.deepEqual(Object.keys(result.value), ['answer']);
        return result.value.answer;
      }),
    );
  assert.deepEqual(await answers(other, theirStaff, admin, second, agent), [0, 0, 0, 0, 0]);
  const direct = await sentAgreement(admin, other);
  assert.equal((await createAgreement(admin, other)).status, 201, 'a draft is not an offer');
  const toStaff = await sentAgreement(admin, theirStaff);
  await fresh(second);
  await fresh(admin);
  // The named recipient answers; senders and in-company hand-overs are not counted.
  assert.deepEqual(await answers(other, theirStaff, admin, second, agent), [1, 1, 0, 0, 0]);
  expire({ agreementId: direct });
  assert.deepEqual(await answers(other, theirStaff), [0, 1], 'an ended offer is not counted');
  // A counter-offer makes it the original sender's turn to answer.
  const counter = await command(theirStaff, toStaff, 'counter', {
    expectedVersion: 2,
    terms: terms(),
  });
  assert.equal(counter.status, 200, JSON.stringify(counter.value));
  assert.deepEqual(await answers(theirStaff, admin, other), [0, 1, 0]);
  for (const workspace of [owner.user.workspaceId, admin.user.workspaceId]) {
    const refused = await agreementsWaiting(owner, workspace);
    assert.equal(refused.status, 403, `Super Admin in ${workspace}`);
  }
});
