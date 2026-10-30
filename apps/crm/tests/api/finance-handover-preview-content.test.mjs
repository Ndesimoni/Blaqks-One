import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { createDeal, dealBody, dealPath, earnDeal, heldClient } from './finance-deals-helpers.mjs';
import { seen, sortedKeys } from './finance-deals-helpers.mjs';
import { accept, expire, offered, preview, reviewTeams } from './finance-handover-helpers.mjs';
import { SECRET, richDeal } from './finance-handover-fixtures.mjs';

// What the review preview shows (agreements design §17 item 1, H2 amendments 10 and 11).
let teams;
before(async () => {
  teams = await reviewTeams('h2-show');
});

const LISTING = [
  ...['listingTitle', 'saleRental', 'emirate', 'community', 'building', 'unitReference'],
  ...['propertyType', 'bedrooms', 'bathrooms', 'sizeSqft', 'priceAed', 'priceBasis'],
  ...['listingStatus', 'readyOffPlan', 'furnishing', 'availableFrom', 'rentalCheques'],
  ...['depositAed', 'minimumStayNights', 'maximumGuests', 'parkingSpaces', 'amenities'],
  ...['description', 'keySellingPoints', 'address', 'mapLink', 'listingUrl'],
  ...['virtualTourUrl', 'floorPlanUrl'],
];
const KEYS = {
  top: ['client', 'deal', 'handover', 'offer', 'property'],
  offer: ['agreementVersion', 'expired', 'expiresAt', 'feeFils', 'kind', 'referralShareBp'],
  deal: [
    ...['agreedValueFils', 'dealType', 'earned', 'feeBasis', 'feeFils', 'feeRateBp'],
    ...['fixedFeeFils', 'milestone', 'netFils', 'nextActionDue', 'openedDate', 'partnerFils'],
    ...['partnerName', 'partnerShareBp', 'receivedFils', 'receiverEarnsFils', 'stage'],
    'targetCloseDate',
  ].sort(),
  // H3 (§18): every listing detail except the owner contact, plus stored photos and plans.
  property: [...LISTING, 'photos', 'floorPlans'].sort(),
};

async function shown(session, handover) {
  const result = await preview(session, teams.admin, handover.id);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value;
}

test('the preview shows the offer, the deal and the property facts, and nothing private', async () => {
  const { admin, agent, second } = teams;
  const { deal, client, contact, property } = await richDeal(agent);
  const handover = await offered(admin, agent, deal, second, { share: 1500 });
  const body = await shown(second, handover);
  assert.deepEqual(sortedKeys(body), KEYS.top);
  assert.deepEqual(sortedKeys(body.offer), KEYS.offer);
  assert.deepEqual(sortedKeys(body.deal), KEYS.deal);
  assert.deepEqual(sortedKeys(body.property), KEYS.property);
  const { agreementVersion, expiresAt, ...offer } = body.offer;
  assert.deepEqual(offer, {
    expired: false,
    kind: 'referral',
    feeFils: 4_900_000,
    referralShareBp: 1500,
  });
  assert.deepEqual({ agreementVersion }, await seen(second, admin, handover));
  assert.match(expiresAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(body.deal, {
    ...{ dealType: 'Sale', stage: 'Offer', earned: false, agreedValueFils: 245_000_000 },
    ...{ feeBasis: 'percentage', feeRateBp: 200, fixedFeeFils: null, feeFils: 4_900_000 },
    ...{ partnerShareBp: 1000, partnerName: 'Synthetic Partner Realty', partnerFils: 490_000 },
    // Half of the net to the agent's line, less the 15% referral the holder keeps.
    ...{ netFils: 4_410_000, receivedFils: 0, receiverEarnsFils: 1_874_250 },
    ...{ openedDate: '2026-10-01', targetCloseDate: '2026-12-15' },
    ...{ milestone: 'Synthetic milestone', nextActionDue: '2026-11-02' },
  });
  assert.deepEqual(body.client, { name: 'Synthetic Z.' });
  assert.deepEqual(body.property, {
    ...Object.fromEntries(LISTING.map((key) => [key, null])),
    ...{ photos: [], floorPlans: [], unitReference: 'ZQX-UNIT-9' },
    ...{ listingTitle: 'Synthetic Marina View', saleRental: 'Sale', emirate: 'Dubai' },
    ...{ community: 'Dubai Marina', building: 'Synthetic Tower', propertyType: 'Apartment' },
    ...{ bedrooms: '2', bathrooms: '3', sizeSqft: '1250', priceAed: '2450000' },
    ...{ readyOffPlan: 'Ready', furnishing: 'Furnished' },
  });
  const text = JSON.stringify(body);
  const hidden = [
    ...[client.id, client.record.client_id, property.id, property.record.property_id],
    ...[contact.id, contact.record.contact_id, 'Zqxbuyer', 'Zqxowner'],
    ...['zqx.buyer@example.test', '+971500000302', 'zqx.owner@example.test', '+971500000301'],
    ...['Zqx client private note', 'Zqx property private note', ...Object.values(SECRET)],
  ];
  for (const value of hidden) assert.ok(!text.includes(value), `the preview leaks ${value}`);
  const terms = ({ offer, deal, client, property }) => ({ offer, deal, client, property });
  assert.deepEqual(terms(await shown(admin, handover)), terms(body), 'the Admin sees the same');
});

test('an earned deal shows no earnings, and a deal without a property shows none', async () => {
  const { admin, agent, second } = teams;
  const client = await heldClient(agent);
  const earned = await earnDeal(admin, await createDeal(agent, client));
  const body = await shown(second, await offered(admin, agent, earned, second));
  assert.deepEqual([body.offer.kind, body.offer.referralShareBp], ['full', null]);
  assert.deepEqual([body.deal.earned, body.deal.receiverEarnsFils], [true, null]);
  assert.equal(body.property, null);
  assert.deepEqual(body.client, { name: 'Synthetic C.' });
});

test('the stage is read live, and the approver sees when the offer has ended', async () => {
  const { admin, agent, second, backup } = teams;
  const client = await heldClient(agent);
  const deal = await createDeal(agent, client);
  const handover = await offered(admin, agent, deal, second, { approver: backup });
  const edited = await agent.request(dealPath(admin, `/${deal.id}`), {
    method: 'PATCH',
    body: { version: deal.version, deal: dealBody(client, { stage: 'Negotiation' }) },
  });
  assert.equal(edited.status, 200, JSON.stringify(edited.value));
  assert.equal((await shown(second, handover)).deal.stage, 'Negotiation');
  const accepted = await accept(second, admin, handover);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.value));
  const before = (await shown(backup, handover)).offer;
  assert.equal(before.expired, false);
  expire(handover);
  const after = (await shown(backup, handover)).offer;
  assert.equal(after.expired, true, 'the approver sees the deadline (amendment 15)');
  assert.ok(Date.parse(after.expiresAt) < Date.now(), after.expiresAt);
});
