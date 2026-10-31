import assert from 'node:assert/strict';
import test from 'node:test';
import { archive, archiveReview } from './archive-helpers.mjs';
import { channelPath, twilioSid } from './channels-helpers.mjs';
import { login, query } from './helpers.mjs';
import { connectMailbox } from './mailbox-helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';
import {
  connectTwilio,
  give,
  given,
  numberEvents,
  setAccess,
  setSenders,
  stored,
  whatsappCompany,
  whatsappStaff,
} from './whatsapp-helpers.mjs';

// Numbers end with the company account and with their member's access (design §4, W-M1).
const ACTIVE = 'active|1';
const ENDED = 'disconnected|2';

test('disconnecting the company Twilio account disconnects every number on it', async () => {
  const { admin, connection, phones } = await whatsappCompany('wa-hooks-company', 2);
  const staff = await whatsappStaff(admin, 'wa-hooks-company-staff');
  const first = await given(admin, staff.user.id, phones[0]);
  const second = await given(admin, admin.user.id, phones[1]);
  const off = await admin.request(channelPath(admin, `/${connection.id}`), {
    method: 'DELETE',
    body: { expectedVersion: connection.version },
  });
  assert.equal(off.status, 200, JSON.stringify(off.value));
  assert.equal(stored(first.id), ENDED);
  assert.equal(stored(second.id), ENDED);
  assert.equal(numberEvents(admin.user.workspaceId, 'number_disconnected'), '2');
  const without = await give(admin, staff.user.id, phones[0]);
  assert.equal(without.status, 400);
  assert.equal(without.value.message, "Connect the company's Twilio account first.");
  // The released numbers can serve the company's next Twilio account.
  const next = twilioSid();
  await setSenders(next, [{ phone: phones[0], status: 'ONLINE' }]);
  assert.equal((await connectTwilio(admin, next)).status, 201);
  assert.equal((await given(admin, staff.user.id, phones[0])).phone, phones[0]);
});

test('suspension, losing the WhatsApp grant and archive each end the member’s number', async () => {
  const { admin, phones } = await whatsappCompany('wa-hooks-members', 3);
  const suspended = await whatsappStaff(admin, 'wa-hooks-suspended');
  const ungranted = await whatsappStaff(admin, 'wa-hooks-ungranted');
  const archived = await whatsappStaff(admin, 'wa-hooks-archived');
  const numbers = [];
  for (const [index, member] of [suspended, ungranted, archived].entries()) {
    numbers.push(await given(admin, member.user.id, phones[index]));
  }
  await setAccess(admin, suspended, { active: false });
  assert.deepEqual(
    numbers.map((number) => stored(number.id)),
    [ENDED, ACTIVE, ACTIVE],
  );
  // Gaining the email grant keeps the number; losing the WhatsApp grant ends it.
  await setAccess(admin, ungranted, { channelAccess: { email: true, whatsapp: true } });
  assert.equal(stored(numbers[1].id), ACTIVE);
  await setAccess(admin, ungranted, { channelAccess: { email: true, whatsapp: false } });
  assert.equal(stored(numbers[1].id), ENDED);
  const owner = await login('owner');
  const review = await archiveReview(owner, admin, await findMember(admin, archived.user.id));
  const done = await archive(owner, admin, review);
  assert.equal(done.status, 200, JSON.stringify(done.value));
  assert.equal(stored(numbers[2].id), ENDED);
  const byOwner = query(`SELECT count(*) FROM integrations.crm_integration_events
    WHERE workspace_id='${admin.user.workspaceId}' AND action='number_disconnected'
      AND actor_id='${owner.user.id}'`);
  assert.equal(byOwner, '1', 'the archive is recorded with the Super Admin as actor');
});

test('archiving an Admin disconnects every number of the company', async () => {
  const { admin, connection, phones } = await whatsappCompany('wa-hooks-archive', 2);
  const staff = await whatsappStaff(admin, 'wa-hooks-archive-staff');
  const numbers = [
    await given(admin, admin.user.id, phones[0]),
    await given(admin, staff.user.id, phones[1]),
  ];
  const owner = await login('owner');
  const review = await archiveReview(owner, owner, await findMember(owner, admin.user.id));
  const done = await archive(owner, owner, review);
  assert.equal(done.status, 200, JSON.stringify(done.value));
  assert.deepEqual(
    numbers.map((number) => stored(number.id)),
    [ENDED, ENDED],
  );
  const account = query(`SELECT state FROM integrations.crm_channel_connections
    WHERE id='${connection.id}'`);
  assert.equal(account, 'disconnected');
});

// W-M1: the Super Admin edits an Admin from the organisation workspace, yet the hook must
// act in the Admin's own company workspace, for E1a mailboxes as well as numbers.
test('the Super Admin suspending an Admin ends their own number and mailbox', async () => {
  const { admin, phones } = await whatsappCompany('wa-hooks-wm1', 2);
  const staff = await whatsappStaff(admin, 'wa-hooks-wm1-staff');
  const mailbox = await connectMailbox(admin, 'wm1-admin@keys-fixture.test');
  const own = await given(admin, admin.user.id, phones[0]);
  const theirs = await given(admin, staff.user.id, phones[1]);
  const owner = await login('owner');
  const member = await findMember(owner, admin.user.id);
  const off = await owner.request(teamPath(owner, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { active: false }),
  });
  assert.equal(off.status, 200, JSON.stringify(off.value));
  assert.equal(stored(own.id), ENDED);
  // A suspension ends only the Admin's own channels; the staff number stays.
  assert.equal(stored(theirs.id), ACTIVE);
  const box = query(`SELECT state||'|'||(credential_sealed IS NULL)
    FROM integrations.crm_channel_connections WHERE id='${mailbox.id}'`);
  assert.equal(box, 'disconnected|true');
  const byOwner = query(`SELECT count(*) FROM integrations.crm_integration_events
    WHERE workspace_id='${admin.user.workspaceId}' AND actor_id='${owner.user.id}'
      AND action IN ('number_disconnected','disconnected')`);
  assert.equal(byOwner, '2');
});
