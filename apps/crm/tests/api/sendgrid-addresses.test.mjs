import assert from 'node:assert/strict';
import test from 'node:test';
import { channelPath } from './channels-helpers.mjs';
import { staffMember } from './mailbox-helpers.mjs';
import { addAddress, addressesPath, connectSendgrid, freshAdmin } from './sendgrid-helpers.mjs';
import { listAddresses } from './sendgrid-helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';

const change = (admin, address, method, body) =>
  admin.request(addressesPath(admin, `/${address.id}`), {
    method,
    body: { expectedVersion: address.version, ...body },
  });

// Packet E3a: sending addresses on the company domain (docs/sendgrid-design.md §3, E3d).
test('only the Admin gives live members with the email grant one address each', async () => {
  const admin = await freshAdmin('sendgrid-address-admin');
  const writer = await staffMember(admin, 'sendgrid-address-writer', true);
  const reader = await staffMember(admin, 'sendgrid-address-reader', false);
  const before = await addAddress(admin, writer.user.id, 'writer');
  assert.equal(before.status, 400);
  assert.match(before.value.message, /Connect the company's SendGrid account first/);
  assert.deepEqual(await listAddresses(admin), { domain: null, addresses: [] });
  const domain = 'e3a-addresses.example.test';
  assert.equal((await connectSendgrid(admin, domain)).status, 201);
  const made = await addAddress(admin, writer.user.id, ' Writer.One ', 'Writer · Keys');
  assert.equal(made.status, 201, JSON.stringify(made.value));
  assert.equal(made.value.address.address, `writer.one@${domain}`);
  assert.equal(made.value.address.state, 'active');
  assert.equal((await addAddress(admin, admin.user.id, 'owner')).status, 201);
  const refusals = [
    [reader.user.id, 'reader', 'Reader', 400, /may send email/],
    ['not-a-uuid', 'nobody', 'Nobody', 400, /may send email/],
    [admin.user.id, 'writer.one', 'Owner', 409, /already used or kept/],
    [writer.user.id, 'second', 'Writer', 409, /already has a sending address/],
    [admin.user.id, 'postmaster', 'Owner', 400, /kept for the company's mail system/],
    [admin.user.id, 'a+b', 'Owner', 400, /lower-case letters/],
    [admin.user.id, 'spoof', 'Boss <ceo@x.test>', 400, /without @, quotes, angle brackets/],
  ];
  for (const [member, local, name, status, message] of refusals) {
    const result = await addAddress(admin, member, local, name);
    assert.equal(result.status, status, local);
    assert.match(result.value.message, message);
  }
  assert.equal((await addAddress(writer, writer.user.id, 'self')).status, 403);
  assert.equal((await writer.request(addressesPath(writer))).status, 403);
  // Another company sees none of them and cannot touch them by ID.
  const rival = await freshAdmin('sendgrid-address-rival');
  assert.deepEqual(await listAddresses(rival), { domain: null, addresses: [] });
  const foreign = await change(rival, made.value.address, 'PATCH', { displayName: 'Taken' });
  assert.equal(foreign.status, 404);
  const listed = await listAddresses(admin);
  assert.equal(listed.domain, domain);
  assert.equal(listed.addresses.length, 2);
});

test('addresses are renamed with versions and reserved for ever for their member', async () => {
  const admin = await freshAdmin('sendgrid-reserve-admin');
  const agent = await staffMember(admin, 'sendgrid-reserve-agent', true);
  const other = await staffMember(admin, 'sendgrid-reserve-other', true);
  const domain = 'e3a-reserve.example.test';
  const { connection } = (await connectSendgrid(admin, domain)).value;
  const address = (await addAddress(admin, agent.user.id, 'agent')).value.address;
  const renamed = await change(admin, address, 'PATCH', { displayName: 'Agent · Keys' });
  assert.equal(renamed.status, 200, JSON.stringify(renamed.value));
  const stale = await change(admin, address, 'PATCH', { displayName: 'Old' });
  assert.equal(stale.status, 409);
  const reserved = await change(admin, renamed.value.address, 'DELETE', {});
  assert.equal(reserved.status, 200);
  assert.equal(reserved.value.address.state, 'reserved');
  assert.equal((await change(admin, renamed.value.address, 'DELETE', {})).status, 200);
  assert.equal((await addAddress(admin, other.user.id, 'agent')).status, 409);
  const back = await addAddress(admin, agent.user.id, 'agent', 'Agent again');
  assert.equal(back.status, 201, JSON.stringify(back.value));
  assert.equal(back.value.address.id, address.id);
  assert.equal(back.value.address.state, 'active');
  // Losing the email grant reserves the address in the same transaction (departure).
  const member = await findMember(admin, agent.user.id);
  const body = memberUpdate(member, { channelAccess: { email: false, whatsapp: false } });
  const updated = await admin.request(teamPath(admin, member.id), { method: 'PATCH', body });
  assert.equal(updated.status, 200, JSON.stringify(updated.value));
  const after = (await listAddresses(admin)).addresses.find((item) => item.id === address.id);
  assert.equal(after.state, 'reserved');
  // A reconnect to the same domain keeps the reservation (review L2).
  const off = await admin.request(channelPath(admin, `/${connection.id}`), {
    method: 'DELETE',
    body: { expectedVersion: connection.version },
  });
  assert.equal(off.status, 200);
  assert.equal((await connectSendgrid(admin, domain)).status, 201);
  assert.equal((await addAddress(admin, other.user.id, 'agent')).status, 409);
  const kept = (await listAddresses(admin)).addresses.find((item) => item.id === address.id);
  assert.equal(kept.state, 'reserved');
});

test('addresses refuse other companies, need the CSRF token and are reserved on suspension', async () => {
  const admin = await freshAdmin('sendgrid-guard-admin');
  const rival = await freshAdmin('sendgrid-guard-rival');
  const outsider = await staffMember(rival, 'sendgrid-guard-outsider', true);
  const agent = await staffMember(admin, 'sendgrid-guard-agent', true);
  assert.equal((await connectSendgrid(admin, 'e3a-guard.example.test')).status, 201);
  assert.equal((await addAddress(admin, outsider.user.id, 'outsider')).status, 400);
  const body = { address: { memberId: agent.user.id, localPart: 'agent', displayName: 'Agent' } };
  const unsigned = await admin.request(addressesPath(admin), { method: 'POST', body, csrf: '' });
  assert.equal(unsigned.status, 403);
  const made = (await addAddress(admin, agent.user.id, 'agent')).value.address;
  const member = await findMember(admin, agent.user.id);
  const suspend = memberUpdate(member, { active: false });
  const updated = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: suspend,
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.value));
  const after = (await listAddresses(admin)).addresses.find((item) => item.id === made.id);
  assert.equal(after.state, 'reserved');
});
