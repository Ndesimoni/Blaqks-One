import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { financePath } from './finance-helpers.mjs';
import { createDeal, heldClient } from './finance-deals-helpers.mjs';
import { accept, offered, preview, reviewTeams } from './finance-handover-helpers.mjs';
import { richDeal } from './finance-handover-fixtures.mjs';
import { listed, seenAs } from './finance-handover-records-helpers.mjs';

// The H3 code security review's fixes (agreements design §18, "H3 as built").
let teams;
before(async () => {
  teams = await reviewTeams('h3-keep');
});

const keepOf = (record, member) =>
  query(`SELECT count(*) FROM crm_record_keeps WHERE record_id='${record.id}'
    AND member_id='${member.user.id}'`);
const live = async (deal) =>
  (await teams.admin.request(financePath(teams.admin))).value.deals.find((d) => d.id === deal.id);
const keptRow = async (session, collection, id) =>
  (await listed(session)).records[collection].find((entry) => entry.id === id);

test('a shared listing carries only its allowlisted fields, and no kept row names a holder', async () => {
  const { admin, agent, third } = teams;
  const { deal, client, property } = await richDeal(agent);
  const propertyId = property.record.property_id;
  await createDeal(agent, await heldClient(agent), { propertyId });
  assert.equal((await accept(third, admin, await offered(admin, agent, deal, third))).status, 200);
  const shared = await keptRow(third, 'Properties', property.id);
  assert.equal(shared.record.listing_title, 'Synthetic Marina View');
  assert.equal(shared.record.property_id, propertyId);
  for (const key of ['notes', 'contact_id', 'record_check'])
    assert.equal(shared.record[key], undefined, `${key} is not shared (review M1)`);
  assert.equal(shared.assignee, null, 'the holder is not named (review L4)');
  assert.equal((await keptRow(agent, 'Clients', client.id)).assignee, null);
  const path = `/workspaces/${admin.user.workspaceId}/records/Properties/${property.id}`;
  const removed = await third.request(path, { method: 'DELETE' });
  assert.ok([403, 404].includes(removed.status), `refused: ${removed.status}`);
  assert.equal(query(`SELECT count(*) FROM crm_records WHERE id='${property.id}'`), '1');
});

test('a keep stays when the record goes to the queue, and ends when its keeper holds it again', async () => {
  const { admin, agent, second, third } = teams;
  const { deal, client } = await richDeal(agent);
  assert.equal(
    (await accept(second, admin, await offered(admin, agent, deal, second))).status,
    200,
  );
  const back = await offered(admin, second, await live(deal), agent);
  assert.equal((await accept(agent, admin, back)).status, 200);
  assert.equal(keepOf(client, agent), '0', 'holding it again ends the old keep (review L2)');
  assert.equal(keepOf(client, second), '1');
  const next = await richDeal(agent);
  assert.equal(
    (await accept(third, admin, await offered(admin, agent, next.deal, third))).status,
    200,
  );
  query(`UPDATE crm_records SET assignee_id=NULL WHERE id='${next.client.id}'`);
  const queued = await seenAs(agent, 'Clients', next.client.id);
  assert.equal(queued.listed, true, 'still kept once queued (review L1)');
  assert.equal(queued.kept.other.id, third.user.id);
});

test('the review shows the full listing only when the sender holds it', async () => {
  const { admin, agent, second, third } = teams;
  const { deal, property } = await richDeal(agent);
  query(`UPDATE crm_records SET assignee_id='${third.user.id}' WHERE id='${property.id}'`);
  const handover = await offered(admin, agent, deal, second);
  const shown = await preview(second, admin, handover.id);
  assert.equal(shown.status, 200, JSON.stringify(shown.value));
  const { listingTitle, unitReference, photos } = shown.value.property;
  assert.deepEqual(
    { listingTitle, unitReference, photos },
    { listingTitle: 'Synthetic Marina View', unitReference: null, photos: [] },
    'another member’s listing shows the basic facts only (review L3)',
  );
});
