import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { signTwilio } from '../../../../scripts/fake-twilio-sign.mjs';
import { channelPath, twilioToken } from './channels-helpers.mjs';
import { query } from './helpers.mjs';
import {
  callback,
  clientWith,
  RESERVED,
  reached,
  sendingCompany,
  sentTo,
  started,
  statusUrl,
} from './whatsapp-send-helpers.mjs';

// Twilio's status callbacks (W1b, docs/whatsapp-design.md §5, §6 and §18, W-M2 and W-L1).
let one;
let two;
const status = (message) =>
  query(`SELECT status||'|'||coalesce(failure_reason,'') FROM inbox.crm_inbox_messages
    WHERE id='${message}'`);

/** A template sent to the quiet number: accepted with no callbacks of its own. */
async function quiet(company) {
  const record = await clientWith(company.agent, RESERVED.quiet);
  const { conversationId, message } = await started(company.agent, record);
  await reached(company.agent, conversationId, message.id, ['sent']);
  const sid = (await sentTo(RESERVED.quiet)).find((item) =>
    item.statusCallback?.endsWith(message.id),
  ).sid;
  const params = (overrides = {}) => ({
    AccountSid: company.sid,
    MessageSid: sid,
    MessageStatus: 'delivered',
    From: `whatsapp:${company.agentNumber.phone}`,
    To: `whatsapp:${RESERVED.quiet}`,
    ...overrides,
  });
  return { message: message.id, sid, params, url: statusUrl(company.connection.id, message.id) };
}

before(async () => {
  one = await sendingCompany('wa-status-one');
  two = await sendingCompany('wa-status-two');
});

test('forged or malformed callbacks are refused before anything changes', async () => {
  const sent = await quiet(one);
  const url = sent.url;
  const refusals = [
    [url, sent.params(), { signature: signTwilio(twilioToken(), url, sent.params()) }],
    [url, sent.params(), { signature: 'not a signature' }],
    [url, sent.params({ AccountSid: two.sid })],
    [`${url}&bodySHA256=abc`, sent.params()],
    [statusUrl(one.connection.id, sent.message, `m=${sent.message.toUpperCase()}`), sent.params()],
    [statusUrl(one.connection.id, sent.message, ''), sent.params()],
    [statusUrl(randomUUID(), sent.message), sent.params()],
    [url, sent.params(), { headers: { 'Content-Type': 'application/json' } }],
    [url, sent.params({ Body: 'x'.repeat(70 * 1024) })],
  ];
  for (const [target, params, options] of refusals) {
    assert.equal(
      await callback(one, target, params, options),
      401,
      `${target} ${JSON.stringify(options)}`,
    );
  }
  // A repeated parameter name is refused rather than guessed at.
  const body = `${new URLSearchParams(sent.params())}&MessageStatus=read`;
  const repeated = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Twilio-Signature': signTwilio(one.token, url, sent.params()),
    },
    body,
  });
  assert.equal(repeated.status, 401);
  assert.equal(status(sent.message), 'sent|');
});

test('a verified callback changes only its own message, matched by To, From and SID', async () => {
  const sent = await quiet(one);
  const other = await quiet(two);
  // Company two's message named on company one's URL, signed by company one.
  const crossed = statusUrl(one.connection.id, other.message);
  assert.equal(await callback(one, crossed, sent.params({ MessageSid: other.sid })), 200);
  assert.equal(status(other.message), 'sent|');
  const ignored = [
    sent.params({ To: 'whatsapp:+99970000000' }),
    sent.params({ From: `whatsapp:${one.adminNumber.phone}` }),
    sent.params({ MessageSid: `SM${'0'.repeat(32)}` }),
    sent.params({ MessageStatus: 'queued' }),
  ];
  for (const params of ignored) assert.equal(await callback(one, sent.url, params), 200);
  assert.equal(await callback(one, statusUrl(one.connection.id, randomUUID()), sent.params()), 200);
  assert.equal(status(sent.message), 'sent|');
  assert.equal(await callback(one, sent.url, sent.params()), 200);
  assert.equal(status(sent.message), 'delivered|');
});

test('statuses only move forward and each applies once', async () => {
  const sent = await quiet(one);
  assert.equal(await callback(one, sent.url, sent.params({ MessageStatus: 'read' })), 200);
  assert.equal(await callback(one, sent.url, sent.params({ MessageStatus: 'read' })), 200);
  for (const backwards of ['delivered', 'sent', 'failed', 'undelivered']) {
    assert.equal(await callback(one, sent.url, sent.params({ MessageStatus: backwards })), 200);
  }
  assert.equal(status(sent.message), 'read|');
  const receipts = query(`SELECT count(*) FROM integrations.crm_webhook_receipts
    WHERE connection_id='${one.connection.id}' AND event_id LIKE 'status:${sent.sid}:%'`);
  assert.equal(receipts, '1');
});

test('a signed callback resolves unknown and maps failures to plain reasons', async () => {
  const sent = await quiet(one);
  query(`UPDATE inbox.crm_inbox_messages SET status='unknown' WHERE id='${sent.message}'`);
  const failed = sent.params({ MessageStatus: 'undelivered', ErrorCode: '63024' });
  assert.equal(await callback(one, sent.url, failed), 200);
  assert.equal(status(sent.message), 'failed|not_on_whatsapp');
  const events =
    query(`SELECT count(*) FROM inbox.crm_inbox_events e JOIN inbox.crm_inbox_messages m
    ON m.conversation_id=e.conversation_id WHERE m.id='${sent.message}' AND e.action='send_failed'`);
  assert.equal(events, '1');
});

test('a disconnected account’s callbacks are refused', async () => {
  const sent = await quiet(two);
  const path = channelPath(two.admin, `/${two.connection.id}`);
  const removed = await two.admin.request(path, {
    method: 'DELETE',
    body: { expectedVersion: two.connection.version },
  });
  assert.equal(removed.status, 200, JSON.stringify(removed.value));
  const url = statusUrl(two.connection.id, sent.message);
  assert.equal(await callback(two, url, sent.params()), 401);
  assert.equal(status(sent.message), 'sent|');
});
