import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { ok, property, publicPath, publicRequest, publish, setup } from './website-helpers.mjs';
import {
  earnedDeal,
  events,
  financeSettings,
  growth,
  metrics,
} from './platform-metrics-helpers.mjs';

let t;
before(async () => {
  query('TRUNCATE crm_login_limits');
  t = await setup('metrics');
  ok(await publish(t.admin, await property(t.admin), t.profile));
});

const enquire = (site) =>
  publicRequest(publicPath(site, 'enquiries'), {
    method: 'POST',
    headers: { 'Idempotency-Key': randomUUID(), 'X-Test-Client': '192.0.2.77' },
    body: {
      name: 'Synthetic Visitor',
      email: `visitor-${randomUUID()}@metrics.test`,
      message: 'A synthetic property question.',
      privacyAcknowledged: true,
      contactPreference: 'email',
    },
  });

test('website enquiries, the leads kept and the property sold through the websites', async () => {
  const first = await metrics(t.owner);
  assert.equal(first.totals.websites.generalSiteLive, true);
  assert.ok(first.totals.websites.companySitesLive >= 2);
  assert.ok(first.totals.websites.listingsLive >= 1);
  const receipt = ok(await enquire(t.a), 201).receipt;
  const client = query(`SELECT r.legacy_id FROM crm_records r
    JOIN enquiries.crm_website_enquiries e ON e.lead_id=r.id WHERE e.id='${receipt}'`);
  assert.ok(client, 'the enquiry became a lead');
  await financeSettings(t.admin);
  await earnedDeal(t.admin, 1_500_000_000, client);
  const after = await metrics(t.owner);
  const grew = growth(first, after, [
    'inPeriod.enquiries',
    'inPeriod.enquiriesToLeads',
    'inPeriod.websiteSales.deals',
    'inPeriod.websiteSales.valueFils',
    'inPeriod.dealsEarned',
    'totals.records.byType.Clients',
  ]);
  assert.deepEqual(Object.values(grew), [1, 1, 1, 1_500_000_000, 1, 1]);
  assert.equal(after.trends.enquiries.at(-1) - first.trends.enquiries.at(-1), 1);
  const workspace = t.admin.user.workspaceId;
  const intake = events(`workspace_id='${workspace}' AND event LIKE 'enquiry_%'`);
  assert.deepEqual(
    intake.map(({ event, source, role, amount }) => [event, source, role, amount]).sort(),
    [
      ['enquiry_lead_created', 'company_site', null, null],
      ['enquiry_received', 'company_site', null, null],
    ],
  );
  const published = events(`workspace_id='${workspace}' AND event='listing_published'`);
  assert.equal(published.length, 1);
  assert.equal(published[0].role, 'admin');
});

test('a lead removed from the CRM no longer counts as kept', async () => {
  const first = await metrics(t.owner);
  const receipt = ok(await enquire(t.a), 201).receipt;
  const lead = JSON.parse(
    query(`SELECT jsonb_build_object('id',r.id,'version',r.version) FROM crm_records r
      JOIN enquiries.crm_website_enquiries e ON e.lead_id=r.id WHERE e.id='${receipt}'`),
  );
  const path = `/workspaces/${t.admin.user.workspaceId}/records/Clients/${lead.id}`;
  const removed = await t.admin.request(path, {
    method: 'DELETE',
    body: { version: lead.version },
  });
  assert.equal(removed.status, 200, JSON.stringify(removed.value));
  const after = await metrics(t.owner);
  const grew = growth(first, after, ['inPeriod.enquiries', 'inPeriod.enquiriesToLeads']);
  assert.deepEqual(grew, { 'inPeriod.enquiries': 1, 'inPeriod.enquiriesToLeads': 0 });
  const [deleted] = events(`workspace_id='${t.admin.user.workspaceId}'
    AND event='record_deleted_clients'`);
  assert.equal(deleted.role, 'admin');
});
