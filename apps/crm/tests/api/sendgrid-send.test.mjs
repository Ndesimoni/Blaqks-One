import assert from 'node:assert/strict';
import test from 'node:test';
import { query } from './helpers.mjs';
import { clientWith, reply, settled, startMessage } from './mailbox-send-helpers.mjs';
import { addAddress, connectSendgrid, freshAdmin } from './sendgrid-helpers.mjs';

const sendgrid = process.env.CRM_TEST_SENDGRID;
const sentTo = async (to) =>
  (await (await fetch(`${sendgrid}/test/state`)).json()).sent.filter((item) => item.to === to);

/** A fresh company sending through SendGrid, with the Admin's own address. */
async function sendingCompany(prefix, domain) {
  const admin = await freshAdmin(prefix);
  assert.equal((await connectSendgrid(admin, domain)).status, 201);
  const made = await addAddress(admin, admin.user.id, 'owner', 'Owner · Keys');
  assert.equal(made.status, 201, JSON.stringify(made.value));
  return admin;
}

// Packet E3b: sending from each member's own address (docs/sendgrid-design.md §5).
test('Start message and replies go from the member’s own address with tracking off', async () => {
  const domain = 'e3b-send.example.test';
  const admin = await sendingCompany('sendgrid-send-admin', domain);
  const client = await clientWith(admin, 'Villa.Buyer@Example.test');
  const started = await startMessage(admin, client, { subject: 'فيلا في جميرا' });
  assert.equal(started.status, 201, JSON.stringify(started.value));
  const { conversationId, message } = started.value;
  assert.equal((await settled(admin, conversationId, message.id)).status, 'sent');
  const [first] = await sentTo('villa.buyer@example.test');
  const rfc = `<${message.id}@${domain}>`;
  assert.deepEqual(first.mail.from, { email: `owner@${domain}`, name: 'Owner · Keys' });
  assert.deepEqual(first.mail.reply_to, first.mail.from);
  assert.equal(first.mail.subject, 'فيلا في جميرا');
  assert.deepEqual(first.mail.headers, { 'Message-ID': rfc });
  assert.deepEqual(first.mail.custom_args, { inbox_message: message.id });
  const tracking = first.mail.tracking_settings;
  assert.equal(tracking.open_tracking.enable, false);
  assert.equal(tracking.click_tracking.enable, false);
  const stored = query(
    `SELECT m.rfc_message_id||'|'||m.provider_message_id||'|'||c.external_thread_id
     FROM inbox.crm_inbox_messages m JOIN inbox.crm_inbox_conversations c
       ON c.id=m.conversation_id WHERE m.id='${message.id}'`,
  );
  assert.equal(stored, `${rfc}|${first.id}|${rfc}`, 'the thread takes the first Message-ID');
  const answered = await reply(admin, conversationId, 'Following up on the villa.');
  assert.equal(answered.status, 201, JSON.stringify(answered.value));
  const second = await settled(admin, conversationId, answered.value.message.id);
  assert.equal(second.status, 'sent');
  const mails = await sentTo('villa.buyer@example.test');
  assert.equal(mails.length, 2);
  assert.equal(mails[1].mail.headers['Message-ID'], `<${second.id}@${domain}>`);
});

test('refusals fail, unclear answers stay unknown and a revoked key asks to reconnect', async () => {
  const domain = 'e3b-fail.example.test';
  const admin = await sendingCompany('sendgrid-fail-admin', domain);
  const outcome = async (email) => {
    const started = await startMessage(admin, await clientWith(admin, email));
    assert.equal(started.status, 201, JSON.stringify(started.value));
    const { conversationId, message } = started.value;
    return settled(admin, conversationId, message.id);
  };
  const refused = await outcome('refuse.me@example.test');
  assert.deepEqual([refused.status, refused.failureReason], ['failed', 'provider_refused']);
  assert.equal((await outcome('crash.me@example.test')).status, 'unknown');
  assert.equal((await sentTo('crash.me@example.test')).length, 0, 'never re-sent');
  await fetch(`${sendgrid}/test/revoke?domain=${domain}`, { method: 'POST' });
  const revoked = await outcome('after.revoke@example.test');
  assert.deepEqual([revoked.status, revoked.failureReason], ['failed', 'mailbox_reconnect']);
  const state = query(
    `SELECT state FROM integrations.crm_channel_connections
     WHERE workspace_id='${admin.user.workspaceId}' AND provider='sendgrid'`,
  );
  assert.equal(state, 'reconnect_required');
  // A company on SendGrid sends only from an address the Admin gave.
  const bare = await freshAdmin('sendgrid-bare-admin');
  assert.equal((await connectSendgrid(bare, 'e3b-bare.example.test')).status, 201);
  const refusedStart = await startMessage(bare, await clientWith(bare, 'bare@example.test'));
  assert.equal(refusedStart.status, 409);
  assert.match(refusedStart.value.message, /sending address on the company email/);
});
