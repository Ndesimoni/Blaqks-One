import assert from 'node:assert/strict';
import test from 'node:test';
import { login, query } from './helpers.mjs';
import {
  clearMailbox,
  connectMailbox,
  fakeGoogleState,
  google,
  mailboxPath,
  staffMember,
} from './mailbox-helpers.mjs';
import { clientWith, reply, sendAgain, settled, startMessage } from './mailbox-send-helpers.mjs';

const admin = await login('admin-a');
await clearMailbox(admin);
await connectMailbox(admin, 'sender@keys-fixture.test');
const sentTo = async (to) => (await fakeGoogleState()).sent.filter((mail) => mail.to === to);

test('Start message sends from the person’s own mailbox and keeps the Gmail thread', async () => {
  const client = await clientWith(admin, 'Marina.Client@Example.test');
  const started = await startMessage(admin, client, {
    subject: 'شقة في دبي مارينا',
    body: 'مرحبا، the viewing is on Saturday.',
  });
  assert.equal(started.status, 201, JSON.stringify(started.value));
  const { conversationId, message } = started.value;
  assert.equal((await settled(admin, conversationId, message.id)).status, 'sent');
  const [mail] = await sentTo('marina.client@example.test');
  assert.equal(mail.from, 'sender@keys-fixture.test');
  assert.equal(mail.subject, 'شقة في دبي مارينا');
  assert.equal(mail.body, 'مرحبا، the viewing is on Saturday.');
  assert.ok(!/^(From|Bcc|Cc):/im.test(mail.headers), 'only To and Subject are addressed');
  const thread = query(
    `SELECT external_thread_id FROM inbox.crm_inbox_conversations WHERE id='${conversationId}'`,
  );
  assert.equal(thread, mail.threadId);
  const answered = await reply(admin, conversationId, 'Following up on the viewing.');
  assert.equal(answered.status, 201, JSON.stringify(answered.value));
  assert.equal((await settled(admin, conversationId, answered.value.message.id)).status, 'sent');
  const mails = await sentTo('marina.client@example.test');
  assert.equal(mails.length, 2);
  assert.equal(mails[1].threadId, mail.threadId, 'the reply stays in the same Gmail thread');
  const events = query(
    `SELECT string_agg(action,',' ORDER BY created_at) FROM inbox.crm_inbox_events
     WHERE conversation_id='${conversationId}'`,
  );
  assert.equal(events, 'started,replied');
});

test('a refused message fails with a code and can be sent again once', async () => {
  const client = await clientWith(admin, 'refused@example.test');
  const started = await startMessage(admin, client);
  const { conversationId, message } = started.value;
  const failed = await settled(admin, conversationId, message.id);
  assert.deepEqual([failed.status, failed.failureReason], ['failed', 'provider_refused']);
  const again = await sendAgain(admin, conversationId, message.id);
  assert.equal(again.status, 201, JSON.stringify(again.value));
  assert.equal(again.value.message.repeatOf, message.id);
  assert.equal((await sendAgain(admin, conversationId, message.id)).status, 400);
});

test('an unclear answer is unknown and never re-sent automatically', async () => {
  const client = await clientWith(admin, 'unclear@example.test');
  const { conversationId, message } = (await startMessage(admin, client)).value;
  const unknown = await settled(admin, conversationId, message.id);
  assert.deepEqual([unknown.status, unknown.failureReason], ['unknown', 'provider_unclear']);
  const attempts = query(
    `SELECT count(*) FROM outbox.crm_outbox_attempts a JOIN outbox.crm_outbox_jobs j
     ON j.id=a.job_id WHERE j.object_id='${message.id}'`,
  );
  assert.equal(attempts, '1');
});

test('sending needs your own connected mailbox and a sendable conversation', async () => {
  const other = await login('admin-b');
  await clearMailbox(other);
  const record = await clientWith(other, 'nobody@example.test');
  const none = await startMessage(other, record);
  assert.deepEqual([none.status, none.value.code], [409, 'mailbox_required']);
  const client = await clientWith(admin, 'blocked-later@example.test');
  const { conversationId } = (await startMessage(admin, client)).value;
  query(`UPDATE inbox.crm_inbox_conversations SET state='spam' WHERE id='${conversationId}'`);
  const spam = await reply(admin, conversationId, 'Hello?');
  assert.deepEqual([spam.status, spam.value.code], [409, 'not_sendable']);
  const missing = await startMessage(admin, { id: '00000000-0000-4000-8000-000000000001' });
  assert.equal(missing.status, 404);
  const noAddress = await clientWith(admin, '');
  assert.equal((await startMessage(admin, noAddress)).status, 400);
  const injected = await startMessage(admin, client, { subject: 'Hi\r\nBcc: x@y.test' });
  assert.equal(injected.status, 400);
});

test('only the mailbox owner replies in its conversations (O9)', async () => {
  const staff = await staffMember(admin, 'send-owner', true);
  await connectMailbox(staff, 'owner-only@keys-fixture.test');
  const mailbox = (await staff.request(mailboxPath(staff))).value.mailbox;
  const id = '00000000-0000-4000-8000-0000000000e1';
  query(
    `INSERT INTO inbox.crm_inbox_conversations (id,workspace_id,channel,connection_id,
       external_thread_id,contact_key,contact_display,match_state,state)
     VALUES ('${id}','${admin.user.workspaceId}','email','${mailbox.id}','t-owner',
       'someone@example.test','someone@example.test','unknown','open')`,
  );
  const answered = await reply(admin, id, 'Replying from the wrong mailbox');
  assert.deepEqual([answered.status, answered.value.code], [409, 'other_mailbox']);
});

// Last: it revokes every token the stand-in issued.
test('a revoked Google grant fails the send and asks the owner to reconnect', async () => {
  const client = await clientWith(admin, 'after-revoke@example.test');
  for (const token of (await fakeGoogleState()).refreshTokens) {
    await fetch(`${google}/revoke`, { method: 'POST', body: new URLSearchParams({ token }) });
  }
  const { conversationId, message } = (await startMessage(admin, client)).value;
  const failed = await settled(admin, conversationId, message.id);
  assert.deepEqual([failed.status, failed.failureReason], ['failed', 'mailbox_reconnect']);
  const state = (await admin.request(`/workspaces/${admin.user.workspaceId}/mailbox`)).value;
  assert.equal(state.mailbox.state, 'reconnect_required');
});
