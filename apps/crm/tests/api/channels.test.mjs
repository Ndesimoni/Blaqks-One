import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  connect,
  connection,
  channelPath as path,
  twilioSid,
  twilioToken,
} from './channels-helpers.mjs';
import { login, query, request } from './helpers.mjs';
import { activate, invite } from './team-helpers.mjs';

let adminA;
let adminB;
let superAdmin;
let staff;
let id;
// The company's Twilio account (W1a): an Account SID and Auth Token the stand-in accepts.
const SID = twilioSid('0001');
const TOKEN = twilioToken();

before(async () => {
  adminA = await login('admin-a');
  adminB = await login('admin-b');
  superAdmin = await login('owner');
  staff = await activate(await invite(adminA, 'channels-staff'));
});

test('an Admin connects an account and the credential is sealed at rest', async () => {
  const response = await connect(adminA, { externalAccountId: SID, credential: TOKEN });
  assert.equal(response.status, 201, JSON.stringify(response.value));
  id = response.value.connection.id;
  const view = response.value.connection;
  assert.equal(view.channel, 'whatsapp');
  assert.equal(view.provider, 'twilio');
  assert.equal(view.state, 'connected');
  assert.equal(view.health, 'healthy');
  assert.equal(view.ownerMemberId, null);
  assert.equal(view.accountHint, '••••0001');
  const text = JSON.stringify(response.value);
  assert.ok(!text.includes(SID));
  assert.ok(!text.includes(TOKEN));
  const stored = query(
    `SELECT count(*)||'|'||bool_and(credential_sealed IS NOT NULL)::text||'|'||
       bool_and(position('${TOKEN}' IN encode(credential_sealed,'escape'))=0)::text
     FROM integrations.crm_channel_connections WHERE id='${id}'`,
  );
  assert.equal(stored, '1|true|true');
  const events = query(
    `SELECT count(*) FROM integrations.crm_integration_events
     WHERE connection_id='${id}' AND action='connected'`,
  );
  assert.equal(events, '1');
  const listed = await adminA.request(path(adminA));
  assert.equal(listed.status, 200);
  assert.ok(listed.value.channels.some((row) => row.id === id));
});

test('only the owning Admin can read or change connections', async () => {
  assert.equal((await staff.request(path(staff))).status, 403);
  assert.equal((await adminB.request(path(adminA))).status, 403);
  assert.equal((await superAdmin.request(path(superAdmin))).status, 403);
  assert.equal((await superAdmin.request(path(adminA))).status, 403);
  const staffWrite = await staff.request(path(staff), {
    method: 'POST',
    body: { connection: connection() },
  });
  assert.equal(staffWrite.status, 403);
  const foreign = await adminB.request(path(adminB, `/${id}`), {
    method: 'DELETE',
    body: { expectedVersion: 1 },
  });
  assert.equal(foreign.status, 404);
  const noCsrf = await request(path(adminA), {
    method: 'POST',
    cookie: adminA.cookie,
    body: { connection: connection() },
  });
  assert.equal(noCsrf.status, 403);
});

test('an account and a channel cannot be connected twice', async () => {
  // Twilio proves the second company's token too, so only a unique index stops it (the
  // exact message is checked with fresh companies in whatsapp-account.test.mjs).
  const acrossCompanies = await connect(adminB, { externalAccountId: SID });
  assert.equal(acrossCompanies.status, 409);
  assert.equal(acrossCompanies.value.code, 'conflict');
  const sameChannel = await connect(adminA);
  assert.equal(sameChannel.status, 409, JSON.stringify(sameChannel.value));
  assert.equal(sameChannel.value.code, 'conflict');
});

test('email is connected per member and rejects unrelated providers', async () => {
  const wrong = await connect(adminA, {
    channel: 'email',
    provider: 'twilio',
    externalAccountId: 'studio@example.test',
  });
  assert.equal(wrong.status, 400);
  const google = await connect(adminA, {
    channel: 'email',
    provider: 'google',
    externalAccountId: 'studio@example.test',
  });
  assert.equal(google.status, 400);
  assert.equal(google.value.message, 'Connect a Google mailbox with Google sign-in.');
  const mail = await connect(adminA, {
    channel: 'email',
    provider: 'microsoft',
    label: 'Studio mailbox',
    externalAccountId: 'studio@example.test',
  });
  assert.equal(mail.status, 201, JSON.stringify(mail.value));
  assert.equal(mail.value.connection.ownerMemberId, adminA.user.id);
});

test('a TikTok business account connects only through the TikTok provider', async () => {
  const account = { channel: 'tiktok', externalAccountId: 'tt-synthetic-0031' };
  const wrong = await connect(adminB, { ...account, provider: 'meta' });
  assert.equal(wrong.status, 400);
  const tiktok = await connect(adminB, { ...account, provider: 'tiktok', label: 'Studio TikTok' });
  assert.equal(tiktok.status, 201, JSON.stringify(tiktok.value));
  assert.equal(tiktok.value.connection.provider, 'tiktok');
  assert.equal(tiktok.value.connection.ownerMemberId, null);
  assert.equal(tiktok.value.connection.accountHint, '••••0031');
});
