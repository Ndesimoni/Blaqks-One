import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { market } from './marketplace-helpers.mjs';
import { client, postHeld, requestTeams } from './marketplace-request-helpers.mjs';
import { held } from './record-sharing-helpers.mjs';

let teams;
let request;
let chosen;
before(async () => {
  teams = await requestTeams('market-lifecycle');
  request = await postHeld(teams.one, (await client(teams, 'one')).id);
});
async function offer(who, suffix) {
  const record = await held(teams.other, who, 'Properties', {
    property_id: `MK-LIFE-${suffix}`,
    listing_title: 'Synthetic matching apartment',
    sale_rental: 'Rental',
    property_type: 'Apartment',
    emirate: 'Dubai',
    community: 'Dubai Marina',
    bedrooms: '2',
    listing_status: 'Available',
    price_annual_rent_aed: '110000',
    unit_reference: 'PRIVATE-UNIT-TEST',
  });
  const preview = await market(who, `/requests/${request.id}/offers/preview`, {
    method: 'POST',
    body: { recordId: record.id },
  });
  assert.equal(preview.status, 200, JSON.stringify(preview.value));
  const result = await market(who, `/requests/${request.id}/offers`, {
    method: 'POST',
    body: { recordId: record.id, previewDigest: preview.value.previewDigest, checked: true },
  });
  assert.equal(result.status, 201, JSON.stringify(result.value));
  return record;
}

test('selection pauses intake and privately notifies only other participants', async () => {
  await offer(teams.agent, 'A');
  await offer(teams.colleague, 'B');
  const result = await market(teams.one, `/requests/${request.id}/offers`);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  chosen = result.value.answers.find((item) => item.memberId === teams.agent.user.id);
  const selected = await market(teams.one, `/requests/${request.id}/select`, {
    method: 'POST',
    body: { answerId: chosen.id, expectedVersion: result.value.request.version },
  });
  assert.equal(selected.status, 200, JSON.stringify(selected.value));
  assert.equal(selected.value.state, 'paused');
  const notifications = await market(teams.colleague, '/notifications');
  assert.equal(notifications.status, 200);
  assert.equal(notifications.value.notifications[0].kind, 'selected_other');
  const text = JSON.stringify(notifications.value);
  assert.equal(text.includes('PRIVATE-UNIT-TEST'), false);
  assert.equal(text.includes('Synthetic matching apartment'), false);
  assert.equal((await market(teams.admin, '/notifications')).value.notifications.length, 0);
  const activity = await market(teams.agent, '/activity');
  assert.equal(activity.value.requests.find((row) => row.id === request.id).state, 'paused');
  const again = await market(teams.one, `/requests/${request.id}/select`, {
    method: 'POST',
    body: { answerId: chosen.id, expectedVersion: result.value.request.version },
  });
  assert.equal(again.status, 409);
});

test('only the poster can reopen; expiry is preserved and old offer history remains', async () => {
  const detail = await market(teams.one, `/requests/${request.id}/offers`);
  const before = (await market(teams.one, '/requests/mine')).value.requests.find(
    (row) => row.id === request.id,
  );
  const body = { expectedVersion: detail.value.request.version };
  assert.equal(
    (await market(teams.admin, `/requests/${request.id}/reopen`, { method: 'POST', body })).status,
    404,
  );
  const result = await market(teams.one, `/requests/${request.id}/reopen`, {
    method: 'POST',
    body,
  });
  assert.equal(result.status, 200, JSON.stringify(result.value));
  const reopened = await market(teams.one, `/requests/${request.id}/offers`);
  assert.equal(reopened.value.request.state, 'open');
  assert.equal(reopened.value.request.activeOffers, 0);
  assert.equal(reopened.value.answers.length, 2);
  assert.ok(reopened.value.answers.every((answer) => answer.state === 'not_chosen'));
  const after = (await market(teams.one, '/requests/mine')).value.requests.find(
    (row) => row.id === request.id,
  );
  assert.equal(after.expiresAt, before.expiresAt);
  assert.equal(
    (await market(teams.colleague, '/notifications')).value.notifications[0].kind,
    'reopened',
  );
});

test('closing a paused request ends its selected offer without deleting history', async () => {
  await offer(teams.agent, 'C');
  const detail = await market(teams.one, `/requests/${request.id}/offers`);
  const answer = detail.value.answers.find((row) => row.state === 'waiting');
  const selected = await market(teams.one, `/requests/${request.id}/select`, {
    method: 'POST',
    body: { answerId: answer.id, expectedVersion: detail.value.request.version },
  });
  assert.equal(selected.status, 200, JSON.stringify(selected.value));
  const closed = await market(teams.one, `/requests/${request.id}/close`, { method: 'POST' });
  assert.equal(closed.status, 200, JSON.stringify(closed.value));
  const history = await market(teams.one, `/requests/${request.id}/offers`);
  assert.equal(history.value.request.state, 'closed');
  assert.equal(history.value.request.activeOffers, 0);
  assert.equal(history.value.answers.length, 3);
  assert.ok(history.value.answers.every((row) => row.listing === null));
});
