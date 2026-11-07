import assert from 'node:assert/strict';
import test from 'node:test';
import { login, query } from './helpers.mjs';
import { archive, archiveReview } from './archive-helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';
import {
  connectMailbox,
  fakeGoogleState,
  finish,
  revokedCount,
  signInAs,
  staffMember,
  start,
} from './mailbox-helpers.mjs';

const adminA = await login('admin-a');

/** The connection row after the change, and whether Google saw one more revoke. */
async function expectRetired(mailbox, revokedBefore) {
  const row = query(
    `SELECT state||'|'||(credential_sealed IS NULL) FROM integrations.crm_channel_connections
     WHERE id='${mailbox.id}'`,
  );
  assert.equal(row, 'disconnected|true');
  assert.equal(await revokedCount(revokedBefore + 1), revokedBefore + 1);
  const pending = query(
    `SELECT count(*) FROM integrations.crm_pending_revocations WHERE connection_id='${mailbox.id}'`,
  );
  assert.equal(pending, '0');
}

async function change(staff, changes) {
  const member = await findMember(adminA, staff.user.id);
  const body = memberUpdate(member, changes);
  const updated = await adminA.request(teamPath(adminA, member.id), { method: 'PATCH', body });
  assert.equal(updated.status, 200, JSON.stringify(updated.value));
}

test('suspending a member disconnects and revokes their mailbox', async () => {
  const staff = await staffMember(adminA, 'departure-suspend', true);
  const mailbox = await connectMailbox(staff, 'suspend@keys-fixture.test');
  const before = (await fakeGoogleState()).revoked.length;
  await change(staff, { active: false });
  await expectRetired(mailbox, before);
});

test('losing the email grant disconnects and revokes the mailbox', async () => {
  const staff = await staffMember(adminA, 'departure-grant', true);
  const mailbox = await connectMailbox(staff, 'grant-off@keys-fixture.test');
  const before = (await fakeGoogleState()).revoked.length;
  await change(staff, { channelAccess: { email: false, whatsapp: false } });
  await expectRetired(mailbox, before);
});

test('archiving a member disconnects and revokes their mailbox', async () => {
  const staff = await staffMember(adminA, 'departure-archive', true);
  const mailbox = await connectMailbox(staff, 'archived@keys-fixture.test');
  const before = (await fakeGoogleState()).revoked.length;
  const owner = await login('owner');
  const review = await archiveReview(owner, adminA, { id: staff.user.id });
  const archived = await archive(owner, adminA, review);
  assert.equal(archived.status, 200, JSON.stringify(archived.value));
  await expectRetired(mailbox, before);
});

test('five sign-ins in ten minutes, used or not, then the limit applies', async () => {
  const staff = await staffMember(adminA, 'departure-limit', true);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const returned = await signInAs(staff, 'limit@keys-fixture.test');
    assert.equal((await finish(staff, { ...returned, code: '4/wrong' })).status, 400);
  }
  const sixth = await start(staff);
  assert.equal(sixth.status, 400);
  assert.match(sixth.value.message, /Try again in ten minutes/);
});

test('an oversized answer from Google is refused without connecting', async () => {
  const staff = await staffMember(adminA, 'departure-oversized', true);
  const finished = await finish(staff, await signInAs(staff, 'oversized@keys-fixture.test'));
  assert.equal(finished.status, 503);
  assert.equal(finished.value.code, 'google_unavailable');
});
