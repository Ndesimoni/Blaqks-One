import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { act as agree, command, detail, ok } from './agreements-a3b-helpers.mjs';
import { terms } from './agreements-helpers.mjs';
import { query } from './helpers.mjs';
import { accepted, listing, listingRequest, outsideTeams } from './outside-sharing-helpers.mjs';

let teams;
before(async () => {
  teams = await outsideTeams('outside-co-guards');
});
const input = (collector = 'sender') =>
  terms({
    money: { ...terms().money, senderShareBp: 5000, collectingParty: collector },
  });
const propose = async (session, share) =>
  ok(
    await listingRequest(session, `/${share.id}/co-broking`, {
      method: 'POST',
      body: { terms: input() },
    }),
    201,
  ).agreement;

test('draft edits and counters cannot remove the collecting party or change a revision on failure', async () => {
  const share = await accepted(teams.one, await listing(teams), teams.agent);
  const draft = await propose(teams.one, share);
  const before = await detail(teams.one, draft.id);
  const missing = input();
  delete missing.money.collectingParty;
  const refused = await teams.one.request(
    `/workspaces/${teams.one.user.workspaceId}/agreements/${draft.id}`,
    {
      method: 'PATCH',
      body: { expectedVersion: draft.version, terms: missing },
    },
  );
  assert.equal(refused.status, 400, JSON.stringify(refused.value));
  const current = await detail(teams.one, draft.id);
  assert.equal(current.revision.terms.money.collectingParty, 'sender');
  assert.equal(current.agreement.version, before.agreement.version);
  assert.equal(current.revision.id, before.revision.id);
  ok(await agree(teams.one, draft.id, 'send'));
  const sent = await detail(teams.agent, draft.id);
  assert.equal((await agree(teams.agent, draft.id, 'counter', { terms: missing })).status, 400);
  const unchanged = await detail(teams.agent, draft.id);
  assert.equal(unchanged.agreement.version, sent.agreement.version);
  assert.equal(unchanged.revision.id, sent.revision.id);
});

test('opposite-party concurrent sends leave exactly one standing offer', async () => {
  const share = await accepted(teams.one, await listing(teams), teams.agent);
  const one = await propose(teams.one, share);
  const two = await propose(teams.agent, share);
  const result = await Promise.all([
    command(teams.one, one.id, 'send', { expectedVersion: one.version }),
    command(teams.agent, two.id, 'send', { expectedVersion: two.version }),
  ]);
  assert.deepEqual(result.map((row) => row.status).sort(), [200, 409]);
  assert.equal(
    query(`SELECT count(*) FROM agreements.crm_agreements
    WHERE listing_share_id='${share.id}' AND state='sent'`),
    '1',
  );
});

test('accepted amendments keep the server-derived property and introduction', async () => {
  const share = await accepted(teams.one, await listing(teams), teams.agent);
  const draft = await propose(teams.one, share);
  ok(await agree(teams.one, draft.id, 'send'));
  ok(await agree(teams.agent, draft.id, 'accept'));
  const current = await detail(teams.one, draft.id);
  const changed = input();
  changed.property.area = 'Invented location';
  changed.property.listingRef = 'INVENTED';
  changed.money.amountFils += 10000;
  ok(await agree(teams.one, draft.id, 'amend', { terms: changed }));
  const offered = await detail(teams.agent, draft.id);
  assert.deepEqual(offered.proposal.terms.introduction, current.revision.terms.introduction);
  assert.deepEqual(
    offered.proposal.terms.subject.property,
    current.revision.terms.subject.property,
  );
  ok(await agree(teams.agent, draft.id, 'amend/accept', { revisionId: offered.proposal.id }));
  const amended = await detail(teams.one, draft.id);
  assert.equal(amended.revision.id, offered.proposal.id);
  assert.equal(amended.revision.terms.money.amountFils, changed.money.amountFils);
  assert.deepEqual(amended.revision.terms.introduction, current.revision.terms.introduction);
});
