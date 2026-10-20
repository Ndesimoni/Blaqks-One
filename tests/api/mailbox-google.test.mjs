import assert from 'node:assert/strict';
import test from 'node:test';
import { login, query } from './helpers.mjs';
import { staffLogin } from './team-helpers.mjs';
import {
  clearMailbox,
  connectMailbox,
  consent,
  fakeGoogleState,
  finish,
  mailboxPath,
  revokedCount,
  signInAs,
  staffMember,
  start,
} from './mailbox-helpers.mjs';

const adminA = await login('admin-a');
const adminB = await login('admin-b');

const staffWithEmail = (suffix, email) => staffMember(adminA, suffix, email);

test('the Admin connects their own Google mailbox and the token stays sealed', async () => {
  await clearMailbox(adminA);
  const mailbox = await connectMailbox(adminA, 'aidah@keys-fixture.test');
  assert.equal(mailbox.provider, 'google');
  assert.equal(mailbox.channel, 'email');
  assert.equal(mailbox.ownerMemberId, adminA.user.id);
  assert.equal(mailbox.state, 'connected');
  // The member sees their own address as the label; the account ID stays masked.
  assert.equal(mailbox.label, 'aidah@keys-fixture.test');
  assert.equal(mailbox.accountHint, '••••test');
  assert.ok(!('credential' in mailbox) && !('externalAccountId' in mailbox));
  const mine = await adminA.request(mailboxPath(adminA));
  assert.deepEqual(
    { google: mine.value.google, mayConnect: mine.value.mayConnect, id: mine.value.mailbox.id },
    { google: true, mayConnect: true, id: mailbox.id },
  );
  const { refreshTokens } = await fakeGoogleState();
  for (const token of refreshTokens) {
    const leaked = query(
      `SELECT count(*) FROM integrations.crm_channel_connections
       WHERE position(convert_to('${token}','UTF8') in credential_sealed)>0`,
    );
    assert.equal(leaked, '0');
  }
});

test('a sign-in is single-use and bound to the session that started it', async () => {
  const staff = await staffWithEmail('mailbox-session', true);
  const returned = await signInAs(staff, 'bea@keys-fixture.test');
  const otherSession = await staffLogin('mailbox-session@team-fixture.test');
  assert.equal((await finish(otherSession, returned)).status, 400);
  assert.equal((await finish(adminA, returned)).status, 400);
  const finished = await finish(staff, returned);
  assert.equal(finished.status, 200, JSON.stringify(finished.value));
  const replay = await finish(staff, returned);
  assert.equal(replay.status, 400);
  assert.equal(replay.value.message, 'This Google sign-in has expired. Start again.');
});

test('missing scopes, other domains and refusals do not connect', async () => {
  const staff = await staffWithEmail('mailbox-refusals', true);
  const onlySend = await signInAs(staff, 'ref@keys-fixture.test', {
    'x-test-scope': 'https://www.googleapis.com/auth/gmail.send',
  });
  const scoped = await finish(staff, onlySend);
  assert.equal(scoped.status, 400);
  assert.match(scoped.value.message, /send and read your email/);
  const personal = await finish(staff, await signInAs(staff, 'someone@gmail.example'));
  assert.equal(personal.status, 400);
  assert.match(personal.value.message, /company's Google Workspace/);
  const started = await start(staff);
  const denied = await consent(started.value.url, { 'x-test-deny': '1' });
  assert.deepEqual(denied, { error: 'denied' });
  const forged = await finish(staff, { state: 'x'.repeat(43), code: '4/forged' });
  assert.equal(forged.status, 400);
  assert.equal((await staff.request(mailboxPath(staff))).value.mailbox, null);
});

test('only the Admin and staff with the email grant may connect', async () => {
  const plain = await staffWithEmail('mailbox-no-grant', false);
  assert.equal((await start(plain)).status, 403);
  assert.equal((await plain.request(mailboxPath(plain))).value.mayConnect, false);
  const owner = await login('owner');
  const asSuperAdmin = await owner.request(`/workspaces/${adminA.user.workspaceId}/mailbox`);
  assert.equal(asSuperAdmin.status, 403);
  const granted = await staffWithEmail('mailbox-grant', true);
  const mailbox = await connectMailbox(granted, 'grant@keys-fixture.test');
  assert.equal(mailbox.ownerMemberId, granted.user.id);
});

test('one Google account belongs to one place, and disconnect revokes it', async () => {
  const staff = await staffWithEmail('mailbox-disconnect', true);
  const mailbox = await connectMailbox(staff, 'shared@keys-fixture.test');
  await clearMailbox(adminB);
  const taken = await finish(adminB, await signInAs(adminB, 'shared@keys-fixture.test'));
  assert.equal(taken.status, 409);
  assert.equal(taken.value.message, 'This account is already connected to a company.');
  const before = (await fakeGoogleState()).revoked.length;
  const off = await staff.request(mailboxPath(staff), {
    method: 'DELETE',
    body: { expectedVersion: mailbox.version },
  });
  assert.equal(off.status, 200, JSON.stringify(off.value));
  assert.equal(off.value.mailbox.state, 'disconnected');
  assert.equal(await revokedCount(before + 1), before + 1);
  const again = await connectMailbox(staff, 'shared@keys-fixture.test');
  assert.notEqual(again.id, mailbox.id);
});

test('the callback never echoes unexpected values', async () => {
  const base = new URL(process.env.CRM_TEST_API).origin;
  const junk = await fetch(
    `${base}/api/crm/integrations/google/callback?state=<x>&code=a%20b&error=evil`,
    { redirect: 'manual' },
  );
  assert.equal(junk.status, 303);
  assert.equal(
    junk.headers.get('location'),
    `${process.env.CRM_APP_ORIGIN}/#/oauth/google?error=failed`,
  );
});
