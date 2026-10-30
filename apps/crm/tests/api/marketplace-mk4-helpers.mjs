import assert from 'node:assert/strict';
import { market } from './marketplace-helpers.mjs';
import { client, postHeld, requestTeams } from './marketplace-request-helpers.mjs';
import { held } from './record-sharing-helpers.mjs';
import { terms } from './agreements-helpers.mjs';
export { market };
export { act, detail, ok } from './agreements-a3b-helpers.mjs';
export const mk4Terms = () =>
  terms({
    client: { displayName: 'PRIVATE-CLIENT-NAME', contact: 'private.client@example.test' },
    money: {
      basis: 'commission',
      amountFils: 5250000,
      senderShareBp: 5000,
      paymentExpectation: 'on_transfer',
      collectingParty: 'sender',
    },
  });
export const offers = (session, request) => market(session, `/requests/${request.id}/offers`);
export const propose = (session, request, input = mk4Terms()) =>
  market(session, `/requests/${request.id}/agreement`, { method: 'POST', body: { terms: input } });

/** Two eligible companies, selected private property, no agreement or release yet. */
export async function selectedFixture(prefix, prepare = async () => ({})) {
  const teams = await requestTeams(prefix);
  const sourceClient = await client(teams, 'one');
  const request = await postHeld(teams.one, sourceClient.id);
  const record = await held(teams.other, teams.agent, 'Properties', {
    property_id: `${prefix}-PR`,
    listing_title: 'PRIVATE-UNIT-IN-TITLE',
    unit_reference: 'PRIVATE-UNIT-MK4',
    address: 'Private Street 44',
    sale_rental: 'Rental',
    property_type: 'Apartment',
    emirate: 'Dubai',
    community: 'Dubai Marina',
    bedrooms: '2',
    listing_status: 'Available',
    price_annual_rent_aed: '110000',
    ...(await prepare(teams)),
  });
  const path = `/requests/${request.id}/offers`;
  const review = await market(teams.agent, `${path}/preview`, {
    method: 'POST',
    body: { recordId: record.id },
  });
  assert.equal(review.status, 200, JSON.stringify(review.value));
  const sent = await market(teams.agent, path, {
    method: 'POST',
    body: { recordId: record.id, previewDigest: review.value.previewDigest, checked: true },
  });
  assert.equal(sent.status, 201, JSON.stringify(sent.value));
  const view = await offers(teams.one, request);
  const answer = view.value.answers[0];
  const chosen = await market(teams.one, `/requests/${request.id}/select`, {
    method: 'POST',
    body: { answerId: answer.id, expectedVersion: view.value.request.version },
  });
  assert.equal(chosen.status, 200, JSON.stringify(chosen.value));
  return { teams, request, answer, share: sent.value.share, record, sourceClient };
}
