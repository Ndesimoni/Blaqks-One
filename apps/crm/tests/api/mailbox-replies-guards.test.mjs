import assert from 'node:assert/strict';
import test from 'node:test';
import { login, query } from './helpers.mjs';
import { clearMailbox, connectMailbox, staffMember } from './mailbox-helpers.mjs';
import { deliver, eventually, imported } from './mailbox-replies-helpers.mjs';
import { clientWith, settled, startMessage } from './mailbox-send-helpers.mjs';

// Security review E1c: ownership (H1), stuck cursor (H2), senders (M1, M2), bounces (M3).
const admin = await login('admin-b');
await clearMailbox(admin);
const MAILBOX = 'guards@keys-fixture.test';
await connectMailbox(admin, MAILBOX);
const mail = (body) => deliver(MAILBOX, body);

async function sentThread(email) {
  const client = await clientWith(admin, email);
  const { conversationId, message } = (await startMessage(admin, client)).value;
  await settled(admin, conversationId, message.id);
  const thread = query(
    `SELECT external_thread_id FROM inbox.crm_inbox_conversations WHERE id='${conversationId}'`,
  );
  return { thread, message: message.id };
}

test('a mailbox’s mail stays with its owner, never the record’s holder', async () => {
  const staff = await staffMember(admin, 'guards-holder', true);
  const record = await clientWith(admin, 'held.client@example.test');
  query(`UPDATE crm_records SET assignee_id='${staff.user.id}' WHERE id='${record.id}'`);
  const sent = await mail({ from: 'held.client@example.test', subject: 'Hi', text: 'Owner test' });
  const assignee = await imported(sent.threadId, 'Owner test', 'c.assignee_id');
  assert.equal(assignee, admin.user.id);
});

test('one oversized message is skipped and later mail still arrives', async () => {
  await clientWith(admin, 'big.sender@example.test');
  await mail({ from: 'big.sender@example.test', subject: 'Huge', text: 'x', oversized: true });
  const next = await mail({ from: 'big.sender@example.test', subject: 'Next', text: 'After big' });
  assert.equal(await imported(next.threadId, 'After big'), 'After big');
});

test('forged senders cannot open conversations, and are flagged in known threads', async () => {
  await clientWith(admin, 'forged.client@example.test');
  const forged = await mail({
    from: 'forged.client@example.test',
    subject: 'Change of bank details',
    text: 'Please pay into a new account',
    unverified: true,
  });
  const { thread } = await sentThread('thread.client@example.test');
  await mail({
    from: 'thread.client@example.test',
    text: 'Spoofed in thread',
    threadId: thread,
    unverified: true,
  });
  await mail({ from: 'cc.person@other.example', text: 'I was copied in', threadId: thread });
  const flagged = await imported(thread, 'Spoofed in thread', "m.sender||'|'||m.sender_unverified");
  assert.equal(flagged, 'thread.client@example.test|true');
  const other = await imported(thread, 'I was copied in', "m.sender||'|'||m.sender_unverified");
  assert.equal(other, 'cc.person@other.example|false');
  const opened = query(
    `SELECT count(*) FROM inbox.crm_inbox_conversations WHERE external_thread_id='${forged.threadId}'`,
  );
  assert.equal(opened, '0');
});

test('only a permanent delivery report fails a sent message', async () => {
  const { thread, message } = await sentThread('receipts@example.test');
  const status = () => query(`SELECT status FROM inbox.crm_inbox_messages WHERE id='${message}'`);
  await mail({
    from: 'receipts@example.test',
    contentType: 'multipart/report; report-type=disposition-notification',
    text: 'Read receipt',
    threadId: thread,
  });
  await mail({
    from: 'mailer-daemon@googlemail.com',
    contentType: 'multipart/report; report-type=delivery-status',
    text: 'Delayed',
    dsn: '4.4.1',
    threadId: thread,
  });
  await mail({ from: 'receipts@example.test', text: 'Marker', threadId: thread });
  await imported(thread, 'Marker');
  assert.equal(status(), 'sent');
  await mail({
    from: 'mailer-daemon@googlemail.com',
    contentType: 'multipart/report; report-type=delivery-status',
    text: 'Address not found',
    dsn: '5.1.1',
    threadId: thread,
  });
  assert.equal(
    await eventually(
      `SELECT 1 FROM inbox.crm_inbox_messages WHERE id='${message}' AND status='failed'`,
    ),
    '1',
  );
});
