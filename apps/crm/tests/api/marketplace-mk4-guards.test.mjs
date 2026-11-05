import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  act,
  detail,
  market,
  mk4Terms,
  offers,
  propose,
  selectedFixture,
} from './marketplace-mk4-helpers.mjs';
import { switchCompany } from './marketplace-helpers.mjs';
import { query } from './helpers.mjs';
import { setAssignee } from './assignment-helpers.mjs';
import { listingRequest } from './outside-sharing-helpers.mjs';

let fixture;
let agreement;
before(async () => {
  fixture = await selectedFixture('mk4-guards');
});

test('malformed and foreign draft proposals fail without releasing information', async () => {
  const { teams, request } = fixture;
  for (const invalid of ['bad', 42, [], true]) {
    const result = await propose(teams.one, request, invalid);
    assert.equal(result.status, 400, JSON.stringify(result.value));
  }
  assert.equal((await propose(teams.admin, request)).status, 404);
  assert.equal((await propose(teams.agent, request)).status, 404);
  const result = await propose(teams.one, request);
  assert.equal(result.status, 201, JSON.stringify(result.value));
  agreement = result.value.agreement;
  assert.equal((await propose(teams.one, request)).status, 409);
  assert.equal(
    query(
      `SELECT count(*) FROM agreements.crm_market_releases WHERE agreement_id='${agreement.id}'`,
    ),
    '0',
  );
});

test('counter-offers remain anonymous and marketplace disable prevents acceptance and release', async () => {
  const { teams, request } = fixture;
  assert.equal((await act(teams.one, agreement.id, 'send')).status, 200);
  const terms = mk4Terms();
  terms.client = { displayName: 'FORGED-PRIVATE-CLIENT', contact: 'hidden@example.test' };
  assert.equal((await act(teams.agent, agreement.id, 'counter', { terms })).status, 200);
  const current = await detail(teams.one, agreement.id);
  assert.equal(JSON.stringify(current).includes('FORGED-PRIVATE-CLIENT'), false);
  assert.equal(JSON.stringify(current).includes('hidden@example.test'), false);
  assert.equal((await switchCompany(teams.other, false, 0)).status, 200);
  const refused = await act(teams.one, agreement.id, 'accept');
  assert.ok([404, 409].includes(refused.status), JSON.stringify(refused.value));
  assert.equal(
    query(
      `SELECT count(*) FROM agreements.crm_market_releases WHERE agreement_id='${agreement.id}'`,
    ),
    '0',
  );
  assert.equal((await switchCompany(teams.other, true, 1)).status, 200);
  const accepted = await act(teams.one, agreement.id, 'accept');
  assert.equal(accepted.status, 200, JSON.stringify(accepted.value));
  const result = await offers(teams.one, request);
  assert.equal(result.value.answers[0].release.released, true);
  assert.equal(
    query(
      `SELECT count(*) FROM agreements.crm_market_releases WHERE agreement_id='${agreement.id}'`,
    ),
    '1',
  );
});

test('release is revoked on suspension, disabled access and reassignment while evidence persists', async () => {
  const { teams, request, share, record } = fixture;
  query(`UPDATE crm_users SET active=false WHERE id='${teams.agent.user.id}'`);
  let result = await listingRequest(teams.one, `/${share.id}`);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.notEqual(result.value.share.release?.released, true);
  assert.equal(JSON.stringify(result.value).includes('PRIVATE-UNIT-MK4'), false);
  query(`UPDATE crm_users SET active=true WHERE id='${teams.agent.user.id}'`);
  assert.equal((await switchCompany(teams.other, false, 2)).status, 200);
  result = await listingRequest(teams.one, `/${share.id}`);
  assert.notEqual(result.value.share.release?.released, true);
  assert.equal((await switchCompany(teams.other, true, 3)).status, 200);
  assert.equal((await offers(teams.one, request)).value.answers[0].release.released, true);
  setAssignee(record.id, teams.colleague.user.id);
  result = await offers(teams.one, request);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.notEqual(result.value.answers[0].release?.released, true);
  assert.equal(JSON.stringify(result.value).includes('PRIVATE-UNIT-MK4'), false);
  assert.equal(
    query(
      `SELECT count(*) FROM agreements.crm_market_releases WHERE agreement_id='${agreement.id}'`,
    ),
    '1',
  );
});

test('acceptance versus reopening has one safe winner and cannot deadlock or duplicate release', async () => {
  const { teams, request, share } = await selectedFixture('mk4-race');
  const created = await propose(teams.one, request);
  assert.equal(created.status, 201, JSON.stringify(created.value));
  const id = created.value.agreement.id;
  assert.equal((await act(teams.one, id, 'send')).status, 200);
  const view = await offers(teams.one, request);
  const [accepted, reopened] = await Promise.all([
    act(teams.agent, id, 'accept'),
    market(teams.one, `/requests/${request.id}/reopen`, {
      method: 'POST',
      body: { expectedVersion: view.value.request.version },
    }),
  ]);
  assert.deepEqual(
    [accepted.status, reopened.status].sort(),
    [200, 409],
    JSON.stringify({ accepted: accepted.value, reopened: reopened.value }),
  );
  const count = query(
    `SELECT count(*) FROM agreements.crm_market_releases WHERE agreement_id='${id}'`,
  );
  assert.equal(count, accepted.status === 200 ? '1' : '0');
  const final = await detail(teams.one, id);
  assert.equal(final.agreement.state, accepted.status === 200 ? 'accepted' : 'sent');
  if (reopened.status === 200) {
    assert.equal(
      query(`SELECT status FROM agreements.crm_listing_shares WHERE id='${share.id}'`),
      'stopped',
    );
    const closed = await market(teams.one, `/requests/${request.id}/close`, { method: 'POST' });
    assert.equal(closed.status, 200, JSON.stringify(closed.value));
  }
});

test('acceptance refuses release after the requester loses the source client', async () => {
  const { teams, request, sourceClient } = await selectedFixture('mk4-source-moved');
  const created = await propose(teams.one, request);
  assert.equal(created.status, 201, JSON.stringify(created.value));
  const id = created.value.agreement.id;
  assert.equal((await act(teams.one, id, 'send')).status, 200);
  setAssignee(sourceClient.id, teams.two.user.id);
  const refused = await act(teams.agent, id, 'accept');
  assert.ok([404, 409].includes(refused.status), JSON.stringify(refused.value));
  assert.equal(
    query(`SELECT count(*) FROM agreements.crm_market_releases WHERE agreement_id='${id}'`),
    '0',
  );
});
