import assert from 'node:assert/strict';
import test from 'node:test';
import { channelPath } from './channels-helpers.mjs';
import { query } from './helpers.mjs';
import { finish, signInAs, staffMember, start } from './mailbox-helpers.mjs';
import { connectSendgrid, freshAdmin, sendgridKey } from './sendgrid-helpers.mjs';

// Packet E3a: a company connects its own SendGrid account (docs/sendgrid-design.md §4).
test('SendGrid connects only with a restricted key for an authenticated domain', async () => {
  const admin = await freshAdmin('sendgrid-connect-admin');
  const domain = 'e3a-connect.example.test';
  const refused = [
    [sendgridKey(domain, 'narrow'), 400, /cannot send mail or read your domain/],
    [sendgridKey(domain, 'broad'), 400, /more access than the CRM needs/],
    [sendgridKey(domain, 'pending'), 400, /has not verified this domain/],
    [sendgridKey('other.example.test'), 400, /has not verified this domain/],
    ['SG.not-a-key', 400, /did not accept this key/],
    [sendgridKey(domain, 'down'), 503, /could not be reached/],
  ];
  for (const [credential, status, message] of refused) {
    const result = await connectSendgrid(admin, domain, credential);
    assert.equal(result.status, status, credential);
    assert.match(result.value.message, message);
  }
  const bad = await connectSendgrid(admin, 'https://e3a.example.test');
  assert.equal(bad.status, 400);
  const staff = await staffMember(admin, 'sendgrid-connect-staff', true);
  assert.equal((await connectSendgrid(staff, domain)).status, 403);
  const connected = await connectSendgrid(admin, ` ${domain.toUpperCase()}. `, sendgridKey(domain));
  assert.equal(connected.status, 201, JSON.stringify(connected.value));
  const { connection } = connected.value;
  assert.equal(connection.provider, 'sendgrid');
  assert.equal(connection.ownerMemberId, null);
  assert.equal(JSON.stringify(connected.value).includes('SG.'), false);
  const stored = query(
    `SELECT external_account_id||'|'||position(convert_to('SG.ok','UTF8') in credential_sealed)
     FROM integrations.crm_channel_connections WHERE id='${connection.id}'`,
  );
  assert.equal(stored, `${domain}|0`, 'the domain is canonical and the key is sealed');
  assert.equal((await connectSendgrid(admin, domain)).status, 409, 'one SendGrid per company');
  const rival = await freshAdmin('sendgrid-rival-admin');
  const taken = await connectSendgrid(rival, domain);
  assert.equal(taken.status, 409);
  assert.match(taken.value.message, /already connected to a company/);
});

test('reconnect keeps the domain, and a company uses one email system at a time', async () => {
  const admin = await freshAdmin('sendgrid-system-admin');
  const domain = 'e3a-system.example.test';
  const { connection } = (await connectSendgrid(admin, domain)).value;
  const reconnect = (credential, expectedVersion = connection.version) =>
    admin.request(channelPath(admin, `/${connection.id}/reconnect`), {
      method: 'POST',
      body: { expectedVersion, credential },
    });
  assert.equal((await reconnect(sendgridKey('elsewhere.example.test'))).status, 400);
  assert.equal((await reconnect(sendgridKey(domain, 'broad'))).status, 400);
  const renewed = await reconnect(sendgridKey(domain));
  assert.equal(renewed.status, 200, JSON.stringify(renewed.value));
  assert.equal(renewed.value.connection.version, connection.version + 1);
  // A Google mailbox cannot join a SendGrid company (decision E3c), refused before consent.
  const google = await start(admin);
  assert.equal(google.status, 409);
  assert.match(google.value.message, /sends email through its SendGrid account/);
  const off = await admin.request(channelPath(admin, `/${connection.id}`), {
    method: 'DELETE',
    body: { expectedVersion: renewed.value.connection.version },
  });
  assert.equal(off.status, 200, JSON.stringify(off.value));
  const mailbox = await finish(admin, await signInAs(admin, 'sendgrid-system@keys-fixture.test'));
  assert.equal(mailbox.status, 200, JSON.stringify(mailbox.value));
  const again = await connectSendgrid(admin, domain);
  assert.equal(again.status, 409);
  assert.match(again.value.message, /already uses another email system/);
});
