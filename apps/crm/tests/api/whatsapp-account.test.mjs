import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import test from 'node:test';
import { channelPath, twilioSid, twilioToken } from './channels-helpers.mjs';
import { login, query } from './helpers.mjs';
import { freshAdmin } from './sendgrid-helpers.mjs';
import {
  connectTwilio,
  numbersPath,
  revoke,
  setSenders,
  whatsappCompany,
  whatsappStaff,
} from './whatsapp-helpers.mjs';

// WhatsApp packet W1a (docs/whatsapp-design.md §4 and §16) against the Twilio stand-in.
const REFUSED = 'Twilio refused these details. Check the Account SID and Auth Token.';
const refusedToken = () => `0000${twilioToken().slice(4)}`;

test('an Admin connects the company Twilio account only when Twilio proves it', async () => {
  const admin = await freshAdmin('wa-account-admin');
  const workspace = admin.user.workspaceId;
  const refused = await connectTwilio(admin, twilioSid(), refusedToken());
  assert.equal(refused.status, 400);
  assert.equal(refused.value.message, REFUSED);
  const suspended = await connectTwilio(admin, twilioSid('dead'));
  assert.equal(suspended.status, 400);
  assert.match(suspended.value.message, /suspended or closed/);
  for (const [sid, token] of [
    ['+971500000001', twilioToken()],
    [twilioSid().toUpperCase(), twilioToken()],
    [twilioSid(), 'synthetic-credential'],
  ]) {
    const malformed = await connectTwilio(admin, sid, token);
    assert.equal(malformed.status, 400, sid);
    assert.match(malformed.value.message, /Account SID|Auth Token/);
  }
  const none = `SELECT count(*) FROM integrations.crm_channel_connections WHERE workspace_id='${workspace}'`;
  assert.equal(query(none), '0', 'nothing is stored before Twilio proves the account');
  const sid = twilioSid('7001');
  const token = twilioToken();
  const made = await connectTwilio(admin, sid, token);
  assert.equal(made.status, 201, JSON.stringify(made.value));
  const view = made.value.connection;
  assert.equal(view.channel, 'whatsapp');
  assert.equal(view.provider, 'twilio');
  assert.equal(view.ownerMemberId, null);
  assert.equal(view.accountHint, '••••7001');
  const text = JSON.stringify(made.value);
  assert.ok(!text.includes(sid) && !text.includes(token));
  const sealed = query(
    `SELECT external_account_id||'|'||(position('${token}' IN encode(credential_sealed,'escape'))=0)
     FROM integrations.crm_channel_connections WHERE id='${view.id}'`,
  );
  assert.equal(sealed, `${sid}|true`);
  // A second company cannot connect the same account, even with a token Twilio accepts.
  const other = await freshAdmin('wa-account-other');
  const taken = await connectTwilio(other, sid);
  assert.equal(taken.status, 409);
  assert.equal(taken.value.message, 'This account is already connected to a company.');
  // Reconnect proves that the new token opens the same Account SID.
  const reconnect = (credential, expectedVersion) =>
    admin.request(channelPath(admin, `/${view.id}/reconnect`), {
      method: 'POST',
      body: { expectedVersion, credential },
    });
  const badToken = await reconnect(refusedToken(), 1);
  assert.equal(badToken.status, 400);
  assert.equal(badToken.value.message, REFUSED);
  const renewed = await reconnect(twilioToken(), 1);
  assert.equal(renewed.status, 200, JSON.stringify(renewed.value));
  assert.equal(renewed.value.connection.version, 2);
});

test('only the owning Admin reads the Twilio senders, with their availability', async () => {
  const company = await whatsappCompany('wa-senders-admin');
  const { admin, sid } = company;
  const path = numbersPath(admin, '/senders');
  const staff = await whatsappStaff(admin, 'wa-senders-staff');
  for (const session of [staff, await login('owner'), await login('admin-a')]) {
    assert.equal((await session.request(path)).status, 403);
  }
  const listed = await admin.request(path);
  assert.equal(listed.status, 200, JSON.stringify(listed.value));
  assert.deepEqual(listed.value.senders, [
    ...company.phones.map((phone) => ({ phone, status: 'ONLINE', available: true })),
    { phone: company.offline, status: 'OFFLINE', available: false },
  ]);
  // Twilio's next-page links are followed: sixty senders arrive over two pages.
  const run = String(randomInt(1000)).padStart(3, '0');
  const many = Array.from({ length: 60 }, (_, index) => ({
    phone: `+9998${run}${String(index).padStart(4, '0')}`,
    status: 'ONLINE',
  }));
  await setSenders(sid, many);
  const paged = await admin.request(path);
  assert.equal(paged.status, 200);
  assert.deepEqual(
    paged.value.senders.map((sender) => sender.phone),
    many.map((sender) => sender.phone),
  );
  // A token Twilio no longer accepts marks the account for reconnecting.
  await revoke(sid);
  const refused = await admin.request(path);
  assert.equal(refused.status, 400);
  assert.match(refused.value.message, /Reconnect the Twilio account/);
  const channels = (await admin.request(channelPath(admin))).value.channels;
  const row = channels.find((channel) => channel.id === company.connection.id);
  assert.equal(row.state, 'reconnect_required');
  assert.equal(row.health, 'attention');
});

test('without a Twilio account there are no senders to list', async () => {
  const admin = await freshAdmin('wa-senders-bare');
  const none = await admin.request(numbersPath(admin, '/senders'));
  assert.equal(none.status, 400);
  assert.equal(none.value.message, "Connect the company's Twilio account first.");
  const listed = await admin.request(numbersPath(admin));
  assert.deepEqual(listed.value, { numbers: [] });
});
