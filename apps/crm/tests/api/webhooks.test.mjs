import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { channelPath, connect } from './channels-helpers.mjs';
import { login, query } from './helpers.mjs';
import { deliver, rows, sign, webhookUrl } from './webhooks-helpers.mjs';

const ACCOUNT = 'ig-hooks-synthetic-0552';
const SECRET = 'webhook-synthetic-secret';
const BODY = JSON.stringify({ from: '+971500000999', text: 'Synthetic enquiry text' });
const event = { account: ACCOUNT, secret: SECRET, body: BODY };
let admin;
let connectionId;

before(async () => {
  admin = await login('admin-b');
  const made = await connect(admin, {
    channel: 'instagram',
    provider: 'meta',
    externalAccountId: ACCOUNT,
    credential: SECRET,
    label: 'Hooks',
  });
  assert.equal(made.status, 201, JSON.stringify(made.value));
  connectionId = made.value.connection.id;
});

test('a verified event is accepted once, sealed and needs no CRM session', async () => {
  const first = await deliver(event);
  assert.equal(first.status, 202, first.text);
  assert.equal(first.text, '');
  assert.equal(first.headers.get('set-cookie'), null);
  assert.equal(rows(first.event), '1|1');
  const stored = query(
    `SELECT r.outcome||'|'||r.workspace_id||'|'||
       (position('Synthetic enquiry' IN encode(s.payload_sealed,'escape'))=0)::text
     FROM integrations.crm_webhook_receipts r
     JOIN integrations.crm_webhook_staging s ON s.receipt_id=r.id WHERE r.event_id='${first.event}'`,
  );
  assert.equal(stored, `received|${admin.user.workspaceId}|true`);
  const replay = await deliver({ ...event, event: first.event });
  assert.equal(replay.status, 202);
  assert.equal(rows(first.event), '1|1');
});

test('every verification failure is one 401 that writes nothing', async () => {
  const failures = [
    { 'X-Stub-Signature': sign('wrong-secret', BODY) },
    { 'X-Stub-Signature': null },
    { 'X-Stub-Signature': 'sha256=zz' },
    { 'X-Stub-Account': 'ig-unknown-synthetic' },
    { 'X-Stub-Provider': 'twilio' },
    { 'X-Stub-Event': 'bad event id' },
  ];
  for (const headers of failures) {
    const result = await deliver(event, headers);
    assert.equal(result.status, 401, JSON.stringify(headers));
    assert.equal(JSON.parse(result.text).code, 'invalid_signature');
    assert.ok(!result.text.includes(ACCOUNT));
    assert.equal(rows(result.event), '0|0');
  }
  const swapped = await deliver(
    { ...event, event: 'evt-swapped-id' },
    { 'X-Stub-Signature': sign(SECRET, `evt-original-id.${BODY}`) },
  );
  assert.equal(swapped.status, 401);
  assert.equal(rows('evt-swapped-id'), '0|0');
  const tampered = await deliver(
    { ...event, body: `${BODY} ` },
    { 'X-Stub-Signature': sign(SECRET, BODY) },
  );
  assert.equal(tampered.status, 401);
  assert.equal(rows(tampered.event), '0|0');
});

test('event IDs are deduplicated per connected account, never across companies', async () => {
  const other = await login('admin-a');
  const theirs = { account: 'ig-hooks-other-0553', secret: 'webhook-other-secret', body: BODY };
  const made = await connect(other, {
    channel: 'instagram',
    provider: 'meta',
    externalAccountId: theirs.account,
    credential: theirs.secret,
    label: 'Other hooks',
  });
  assert.equal(made.status, 201, JSON.stringify(made.value));
  const shared = 'evt-shared-across-companies';
  assert.equal((await deliver({ ...event, event: shared })).status, 202);
  assert.equal((await deliver({ ...theirs, event: shared })).status, 202);
  assert.equal(rows(shared), '2|2');
});

test('only signed JSON of bounded size reaches verification', async () => {
  const text = await deliver(event, { 'Content-Type': 'text/plain' });
  assert.equal(text.status, 415);
  const huge = 'x'.repeat(1024 * 1024 + 1);
  const oversized = await deliver({ ...event, body: huge });
  assert.equal(oversized.status, 413);
  assert.equal(rows(oversized.event), '0|0');
  const real = await deliver(event, { provider: 'twilio' });
  assert.equal(real.status, 404);
  const read = await fetch(webhookUrl());
  assert.equal(read.status, 405);
});

test('a disconnected connection can no longer deliver events', async () => {
  const gone = await admin.request(channelPath(admin, `/${connectionId}`), {
    method: 'DELETE',
    body: { expectedVersion: 1 },
  });
  assert.equal(gone.status, 200, JSON.stringify(gone.value));
  const late = await deliver(event);
  assert.equal(late.status, 401);
  assert.equal(rows(late.event), '0|0');
});
