import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { phone } from './whatsapp-helpers.mjs';
import {
  agree,
  clientWith,
  offered,
  reached,
  read,
  reply,
  sendingCompany,
  sentTo,
  start,
  started,
  statusUrl,
} from './whatsapp-send-helpers.mjs';

// WhatsApp sending (W1b, docs/whatsapp-design.md §5 and §18) through the Twilio stand-in.
let company;
const inboundAgo = (id, interval) =>
  query(`UPDATE inbox.crm_inbox_conversations SET last_inbound_at=now()-interval '${interval}'
    WHERE id='${id}'`);

before(async () => {
  company = await sendingCompany('wa-send');
});

test('Start message sends a template from the member’s own number, then Sent, Delivered and Read', async () => {
  const { agent, admin, connection } = company;
  const number = phone();
  const record = await clientWith(agent, number);
  assert.equal((await agree(agent, record)).status, 200);
  const id = await offered(agent, record, 'viewing_reminder');
  const variables = ['Sara', 'Saturday at 5 pm'];
  const result = await start(agent, record, { template: { id, variables } });
  assert.equal(result.status, 201, JSON.stringify(result.value));
  const { conversationId, message } = result.value;
  assert.equal(message.body, 'Hello Sara, this is a reminder of your viewing on Saturday at 5 pm.');
  assert.deepEqual([message.status, message.template], ['queued', id]);
  const view = (await read(agent, conversationId)).conversation.whatsapp;
  assert.equal(view.numberId, company.agentNumber.id);
  assert.equal(view.numberOwnerId, agent.user.id);
  assert.deepEqual(
    [view.canSend, view.canSendTemplate, view.canSendText, view.refusal],
    [true, true, false, null],
  );
  assert.deepEqual(view.window, { open: false, until: null });
  const done = await reached(agent, conversationId, message.id, ['read']);
  assert.equal(done.template, id);
  const [sent] = await sentTo(number);
  assert.deepEqual(sent.fields, ['From', 'To', 'ContentSid', 'ContentVariables', 'StatusCallback']);
  assert.equal(sent.from, `whatsapp:${company.agentNumber.phone}`);
  assert.equal(sent.contentSid, id);
  assert.deepEqual(JSON.parse(sent.contentVariables), { 1: 'Sara', 2: 'Saturday at 5 pm' });
  assert.equal(sent.statusCallback, statusUrl(connection.id, message.id));
  assert.deepEqual(sent.callbacks, ['sent', 'delivered', 'read']);
  const stored = query(`SELECT provider_message_id||'|'||array_to_string(template_variables,'|')
    FROM inbox.crm_inbox_messages WHERE id='${message.id}'`);
  assert.equal(stored, `${sent.sid}|Sara|Saturday at 5 pm`);
  const thread = query(`SELECT external_thread_id||'|'||whatsapp_number_id
    FROM inbox.crm_inbox_conversations WHERE id='${conversationId}'`);
  assert.equal(thread, `wa:${company.agentNumber.id}:${number}|${company.agentNumber.id}`);
  const receipts = query(`SELECT string_agg(event_id,',' ORDER BY event_id)
    FROM integrations.crm_webhook_receipts WHERE connection_id='${connection.id}'
    AND event_id LIKE 'status:${sent.sid}:%' AND event_id NOT LIKE '%:sent'`);
  // `sent` leaves a receipt only when its callback beat the worker's own `sent`.
  assert.equal(receipts, ['delivered', 'read'].map((s) => `status:${sent.sid}:${s}`).join());
  // Nothing outside the message itself keeps the phone, the text or a variable (§3).
  const workspace = admin.user.workspaceId;
  const traces = query(`SELECT concat_ws('|',
      (SELECT string_agg(e::text,'') FROM inbox.crm_inbox_events e WHERE workspace_id='${workspace}'),
      (SELECT string_agg(e::text,'') FROM integrations.crm_integration_events e
        WHERE workspace_id='${workspace}'),
      (SELECT string_agg(j::text,'') FROM outbox.crm_outbox_jobs j WHERE workspace_id='${workspace}'),
      (SELECT string_agg(a::text,'') FROM outbox.crm_outbox_attempts a
        JOIN outbox.crm_outbox_jobs j ON j.id=a.job_id WHERE j.workspace_id='${workspace}'),
      (SELECT string_agg(r::text,'') FROM integrations.crm_webhook_receipts r
        WHERE workspace_id='${workspace}'))`);
  for (const secret of [number, number.slice(1), 'Sara', 'Saturday', company.token]) {
    assert.ok(!traces.includes(secret), secret);
  }
  // Starting again for the same client joins the same thread on that number.
  const more = await start(agent, record, { template: { id, variables: ['Sara', 'Sunday'] } });
  assert.equal(more.value.conversationId, conversationId);
  const events = query(`SELECT string_agg(action,',' ORDER BY created_at)
    FROM inbox.crm_inbox_events WHERE conversation_id='${conversationId}'`);
  assert.equal(events, 'started,replied');
});

test('free text needs the 24-hour window, measured by the server clock', async () => {
  const number = phone();
  const record = await clientWith(company.agent, number);
  const { conversationId } = await started(company.agent, record);
  inboundAgo(conversationId, '1 hour');
  const open = (await read(company.agent, conversationId)).conversation.whatsapp;
  assert.equal(open.window.open, true);
  const left = Date.parse(open.window.until) - Date.now();
  assert.ok(Math.abs(left - (22 * 60 + 50) * 60_000) < 120_000, String(left));
  assert.equal(open.canSendText, true);
  const sent = await reply(company.agent, conversationId, { body: '  Hello, is Saturday fine?  ' });
  assert.equal(sent.status, 201, JSON.stringify(sent.value));
  assert.deepEqual(
    [sent.value.message.body, sent.value.message.template],
    ['Hello, is Saturday fine?', null],
  );
  await reached(company.agent, conversationId, sent.value.message.id, ['read']);
  const text = (await sentTo(number)).find((item) => item.body);
  assert.deepEqual(text.fields, ['From', 'To', 'Body', 'StatusCallback']);
  assert.equal(text.body, 'Hello, is Saturday fine?');
  inboundAgo(conversationId, '23 hours 51 minutes');
  const closed = (await read(company.agent, conversationId)).conversation.whatsapp;
  assert.deepEqual([closed.window.open, closed.canSendText], [false, false]);
  const refused = await reply(company.agent, conversationId, { body: 'Hello again' });
  assert.deepEqual([refused.status, refused.value.code], [409, 'window_closed']);
  const id = await offered(company.agent, record, 'new_listing');
  const template = await reply(company.agent, conversationId, { template: { id, variables: [] } });
  assert.equal(template.status, 201, JSON.stringify(template.value));
});
