import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import {
  ok,
  property,
  publicPath,
  publicRequest,
  publish,
  setup,
  websitePath,
} from './website-helpers.mjs';

let t, listing;
before(async () => {
  t = await setup('enquiry');
  listing = ok(await publish(t.admin, await property(t.admin), t.profile)).publication;
});
const body = (extra = {}) => ({
  listingId: listing.id,
  name: 'Synthetic Visitor',
  email: `visitor-${randomUUID()}@enquiry.test`,
  message: 'A property question.',
  privacyAcknowledged: true,
  contactPreference: 'email',
  ...extra,
});
let client = 0;
const send = (payload, key = randomUUID(), site = t.a) =>
  publicRequest(publicPath(site, 'enquiries'), {
    method: 'POST',
    headers: { 'Idempotency-Key': key, 'X-Test-Client': `192.0.2.${++client}` },
    body: payload,
  });

test('anonymous enquiry commits one CRM lead and an opaque receipt, including concurrent retries', async () => {
  const payload = body(),
    key = randomUUID();
  const first = ok(await send(payload, key), 201);
  assert.equal(first.status, 'received');
  assert.ok(first.receipt);
  const attempts = await Promise.all([send(payload, key), send(payload, key)]);
  assert.ok(attempts.every((r) => r.status === 200 && r.value.receipt === first.receipt));
  assert.equal((await send({ ...payload, message: 'Different message' }, key)).status, 409);
  const rows = query(
    `SELECT count(*) FROM enquiries.crm_website_enquiries WHERE id='${first.receipt}'`,
  );
  assert.equal(rows, '1');
  const read = ok(await t.admin.request(websitePath(t.admin, '/enquiries')));
  assert.ok(JSON.stringify(read).includes(payload.email));
  assert.equal((await t.other.request(websitePath(t.admin, '/enquiries'))).status, 403);
  const lead = JSON.parse(
    query(
      `SELECT r.payload FROM crm_records r JOIN enquiries.crm_website_enquiries e ON e.lead_id=r.id WHERE e.id='${first.receipt}'`,
    ),
  );
  assert.equal(lead.lead_source, 'Website');
  assert.equal(lead.contact_permission, 'Unknown');
  assert.ok(!JSON.stringify(first).includes(t.admin.user.workspaceId));
});

test('contact, privacy, company and representative checks cannot be bypassed', async () => {
  assert.equal((await send(body({ privacyAcknowledged: false }))).status, 400);
  assert.equal((await send(body({ email: undefined }))).status, 400);
  assert.equal((await send(body({ workspaceId: t.other.user.workspaceId }))).status, 400);
  assert.equal((await send(body({ agentId: t.otherProfile.id }))).status, 404);
  assert.equal((await send(body(), randomUUID(), t.b)).status, 404);
  assert.equal((await send(body({ listingId: undefined }), 'bad-key')).status, 400);
  const platform = await send(body({ listingId: undefined }), randomUUID(), t.platform);
  assert.equal(platform.status, 400);
});

test('company enquiries go to their own Admin and new enquiries stop on withdrawal', async () => {
  const received = ok(await send(body({ listingId: undefined })), 201);
  assert.equal(
    query(
      `SELECT workspace_id FROM enquiries.crm_website_enquiries WHERE id='${received.receipt}'`,
    ),
    t.admin.user.workspaceId,
  );
  ok(
    await t.admin.request(websitePath(t.admin, `/listings/${listing.id}/withdraw`), {
      method: 'POST',
      body: { version: listing.version },
    }),
  );
  assert.equal((await send(body())).status, 404);
});
