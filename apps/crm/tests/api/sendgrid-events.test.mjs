import assert from 'node:assert/strict';
import test from 'node:test';
import { channelPath } from './channels-helpers.mjs';
import { query } from './helpers.mjs';
import { clientWith, sendAgain, settled, startMessage } from './mailbox-send-helpers.mjs';
import { addAddress, connectSendgrid, freshAdmin } from './sendgrid-helpers.mjs';

const sendgrid = process.env.CRM_TEST_SENDGRID;
/** The stand-in signs `events` like SendGrid and posts them to the domain's webhook. */
const deliver = async (domain, events, options = {}) =>
  (
    await fetch(`${sendgrid}/test/events?domain=${domain}`, {
      method: 'POST',
      body: JSON.stringify({ events, ...options }),
    })
  ).json();

async function company(prefix, domain) {
  const admin = await freshAdmin(prefix);
  const connected = await connectSendgrid(admin, domain);
  assert.equal(connected.status, 201, JSON.stringify(connected.value));
  assert.equal(connected.value.deliveryUpdates, true);
  assert.equal((await addAddress(admin, admin.user.id, 'owner')).status, 201);
  const send = async (email) => {
    const started = await startMessage(admin, await clientWith(admin, email));
    assert.equal(started.status, 201, JSON.stringify(started.value));
    const { conversationId, message } = started.value;
    assert.equal((await settled(admin, conversationId, message.id)).status, 'sent');
    const provider = query(
      `SELECT provider_message_id FROM inbox.crm_inbox_messages WHERE id='${message.id}'`,
    );
    const status = async () => settled(admin, conversationId, message.id);
    return { id: message.id, provider, conversationId, status };
  };
  return { admin, send, connection: connected.value.connection };
}

const event = (kind, sent, extra = {}) => ({
  event: kind,
  email: 'someone@example.test',
  inbox_message: sent.id,
  sg_message_id: `${sent.provider}.filter0001.1.0`,
  sg_event_id: `evt-${Math.random()}`,
  ...extra,
});

// Packet E3b: delivery statuses from SendGrid's signed Event Webhook (design §6).
test('signed events mark mail delivered or failed, only in their own company', async () => {
  const domain = 'e3b-events.example.test';
  const { admin, send, connection } = await company('sendgrid-events-admin', domain);
  const first = await send('events.one@example.test');
  const delivered = await deliver(domain, [event('delivered', first)]);
  assert.equal(delivered.status, 200);
  assert.equal(delivered.events.open, false, 'the webhook never asks for opens or clicks');
  assert.equal((await first.status()).status, 'delivered');
  assert.equal((await deliver(domain, [event('delivered', first)])).status, 200, 'replay');
  await deliver(domain, [event('bounce', first, { reason: '550 no such user' })]);
  const bounced = await first.status();
  assert.deepEqual([bounced.status, bounced.failureReason], ['failed', 'bounced']);
  // Forged or stale requests are refused and change nothing.
  const second = await send('events.two@example.test');
  const forged = await deliver(domain, [event('delivered', second)], { signWith: 'other' });
  assert.equal(forged.status, 401);
  const stale = Math.floor(Date.now() / 1000) - 600;
  assert.equal(
    (await deliver(domain, [event('delivered', second)], { timestamp: stale })).status,
    401,
  );
  assert.equal((await second.status()).status, 'sent');
  // An event naming another company's message changes nothing there.
  const rival = await company('sendgrid-events-rival', 'e3b-rival.example.test');
  const theirs = await rival.send('rival.client@example.test');
  assert.equal((await deliver(domain, [event('delivered', theirs)])).status, 200);
  assert.equal((await theirs.status()).status, 'sent');
  // Disconnecting removes the webhook at SendGrid and forgets its key.
  const off = await admin.request(channelPath(admin, `/${connection.id}`), {
    method: 'DELETE',
    body: { expectedVersion: connection.version },
  });
  assert.equal(off.status, 200, JSON.stringify(off.value));
  assert.equal(
    query(`SELECT count(*) FROM integrations.crm_sendgrid_webhooks
    WHERE connection_id='${connection.id}'`),
    '0',
  );
  const late = await fetch(delivered.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Twilio-Email-Event-Webhook-Signature': 'MEUCIQ==',
      'X-Twilio-Email-Event-Webhook-Timestamp': String(Math.floor(Date.now() / 1000)),
    },
    body: JSON.stringify([event('delivered', second)]),
  });
  assert.equal(late.status, 401);
  assert.equal((await deliver(domain, [event('delivered', second)])).error, 'no signed webhook');
});

test('a late timeout never undoes a delivered event, and a refused disconnect keeps the webhook', async () => {
  const domain = 'e3b-race.example.test';
  const { admin, connection } = await company('sendgrid-race-admin', domain);
  // SendGrid accepts, signs Delivered, then the call itself fails (review M1).
  const started = await startMessage(
    admin,
    await clientWith(admin, 'deliver-then-crash@example.test'),
  );
  assert.equal(started.status, 201, JSON.stringify(started.value));
  const { conversationId, message } = started.value;
  assert.equal((await settled(admin, conversationId, message.id)).status, 'delivered');
  const again = await sendAgain(admin, conversationId, message.id);
  assert.notEqual(again.status, 201, 'a delivered message is never offered again');
  // A stale disconnect is refused before SendGrid is touched (review M2).
  const stale = await admin.request(channelPath(admin, `/${connection.id}`), {
    method: 'DELETE',
    body: { expectedVersion: connection.version + 5 },
  });
  assert.equal(stale.status, 409);
  assert.equal((await deliver(domain, [])).status, 200, 'the webhook still delivers events');
});
