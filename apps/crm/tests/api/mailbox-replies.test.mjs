import assert from 'node:assert/strict';
import test from 'node:test';
import { login, query } from './helpers.mjs';
import { clearMailbox, connectMailbox, fakeGoogleState, google } from './mailbox-helpers.mjs';
import { clientWith, reply, settled, startMessage } from './mailbox-send-helpers.mjs';

const admin = await login('admin-b');
await clearMailbox(admin);
const MAILBOX = 'replies@keys-fixture.test';
await connectMailbox(admin, MAILBOX);
const inbox = `/workspaces/${admin.user.workspaceId}/inbox/conversations`;

const deliver = async (mail) =>
  (
    await fetch(`${google}/test/deliver`, {
      method: 'POST',
      body: JSON.stringify({ to: MAILBOX, ...mail }),
    })
  ).json();

/** Waits until `check` passes on the conversation, as the worker syncs every second. */
async function until(conversation, check) {
  for (let tries = 0; tries < 100; tries += 1) {
    const read = (await admin.request(`${inbox}/${conversation}`)).value;
    if (check(read)) return read;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw Error('The mailbox sync did not reach the expected state.');
}

async function sentThread(email) {
  const client = await clientWith(admin, email);
  const { conversationId, message } = (await startMessage(admin, client)).value;
  assert.equal((await settled(admin, conversationId, message.id)).status, 'sent');
  const thread = query(
    `SELECT external_thread_id FROM inbox.crm_inbox_conversations WHERE id='${conversationId}'`,
  );
  return { conversationId, thread };
}

test('a client’s reply joins its conversation and the next reply threads to it', async () => {
  const { conversationId, thread } = await sentThread('replier@example.test');
  const parent = '<reply-1@mail.example.test>';
  await deliver({
    from: 'Replier Client <Replier@Example.test>',
    subject: 'Re: Your viewing in Dubai Marina',
    text: 'Yes, Saturday at 5 works for me.',
    threadId: thread,
    messageId: parent,
  });
  const read = await until(conversationId, (value) =>
    value.messages.some((item) => item.direction === 'inbound'),
  );
  const inbound = read.messages.find((item) => item.direction === 'inbound');
  assert.equal(inbound.body, 'Yes, Saturday at 5 works for me.');
  assert.equal(read.conversation.state, 'open');
  const answered = await reply(admin, conversationId, 'See you on Saturday.');
  await settled(admin, conversationId, answered.value.message.id);
  const last = (await fakeGoogleState()).sent.at(-1);
  assert.equal(last.inReplyTo, parent);
  assert.equal(last.threadId, thread);
  assert.equal(last.subject, 'Re: Your viewing in Dubai Marina');
});

test('only mail from known threads or linked clients is imported', async () => {
  await clientWith(admin, 'known.sender@example.test');
  await deliver({ from: 'stranger@example.test', subject: 'Newsletter', text: 'Offers' });
  const known = await deliver({
    from: 'known.sender@example.test',
    subject: 'Another property',
    html: '<p>Is the <b>villa</b> free?</p><script>alert(1)</script><img src="https://t.example/x.gif">',
    attachment: 'passport.pdf',
  });
  let row = '';
  for (let tries = 0; tries < 100 && !row; tries += 1) {
    row = query(
      `SELECT c.match_state||'|'||c.subject||'|'||m.body||'|'||m.has_media
       FROM inbox.crm_inbox_conversations c JOIN inbox.crm_inbox_messages m
       ON m.conversation_id=c.id WHERE c.external_thread_id='${known.threadId}'`,
    );
    if (!row) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.equal(row, 'linked|Another property|Is the villa free?|true');
  const stranger = query(
    `SELECT count(*) FROM inbox.crm_inbox_conversations WHERE contact_key='stranger@example.test'`,
  );
  assert.equal(stranger, '0');
});

test('a bounce fails the sent message and is never shown as client mail', async () => {
  const { conversationId, thread } = await sentThread('bounce-me@example.test');
  await deliver({
    from: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>',
    subject: 'Delivery Status Notification (Failure)',
    contentType: 'multipart/report; report-type=delivery-status',
    text: 'Address not found',
    dsn: '5.1.1',
    threadId: thread,
  });
  const read = await until(conversationId, (value) =>
    value.messages.some((item) => item.failureReason === 'bounced'),
  );
  assert.equal(read.messages.filter((item) => item.direction === 'inbound').length, 0);
});
