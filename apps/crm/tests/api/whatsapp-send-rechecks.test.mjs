import assert from 'node:assert/strict';
import { test } from 'node:test';
import { query } from './helpers.mjs';
import { disconnectNumber, setAccess, stored, twilio } from './whatsapp-helpers.mjs';
import {
  agree,
  clientWith,
  RESERVED,
  reached,
  reply,
  sendingCompany,
  setTemplates,
  started,
} from './whatsapp-send-helpers.mjs';

// The worker re-checks everything right before it calls Twilio (W1b, docs/whatsapp-design.md
// §5; security review L5). The stand-in's held number answers the first attempt with `429`
// and Retry-After: 5, so each case changes the state while the job waits; the retry must
// then fail with the right reason, and Twilio never accepts the message.
const final = ['sent', 'delivered', 'read', 'failed', 'unknown'];
const state = async () => (await fetch(`${twilio}/test/state`)).json();
const attemptsOf = async (message) =>
  (await state()).sent.filter((item) => item.statusCallback?.endsWith(message));

/** Waits until the stand-in refused the message's first attempt with `429`. */
async function held(message) {
  for (let tries = 0; tries < 50; tries += 1) {
    if ((await attemptsOf(message)).some((item) => item.answer === 429)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(`The stand-in never held ${message}.`);
}

/** Starts a template to the held number, changes the state, and checks the retry. */
async function refusedAfter(prefix, change, reason) {
  const company = await sendingCompany(prefix);
  const record = await clientWith(company.agent, RESERVED.held);
  const { conversationId, message } = await started(company.agent, record);
  await held(message.id);
  await change(company, record);
  const settled = await reached(company.admin, conversationId, message.id, final, 100);
  assert.deepEqual([settled.status, settled.failureReason], ['failed', reason]);
  const answers = (await attemptsOf(message.id)).map((item) => item.answer);
  assert.deepEqual(answers, [429], 'Twilio never accepted it');
}

test('a STOP recorded while the send waits stops it', () =>
  refusedAfter(
    'wa-recheck-stop',
    (company, record) => agree(company.admin, record, { change: 'stopped' }),
    'opted_out',
  ));

test('a number disconnected while the send waits stops it', () =>
  refusedAfter(
    'wa-recheck-number',
    async (company) => {
      assert.equal((await disconnectNumber(company.agent, company.agentNumber)).status, 200);
    },
    'sender_unavailable',
  ));

test('losing the WhatsApp grant while the send waits stops it', () =>
  refusedAfter(
    'wa-recheck-grant',
    (company) =>
      setAccess(company.admin, company.agent, { channelAccess: { email: false, whatsapp: false } }),
    'sender_unavailable',
  ));

test('a template Twilio no longer lists stops the send', () =>
  refusedAfter(
    'wa-recheck-template',
    async (company) => {
      await setTemplates(company.sid, [
        { name: 'viewing_reminder', status: 'approved', body: 'Hi {{1}}.' },
      ]);
      const path = `/workspaces/${company.admin.user.workspaceId}/whatsapp-templates/refresh`;
      assert.equal((await company.admin.request(path, { method: 'POST', body: {} })).status, 200);
    },
    'template_unavailable',
  ));

test('free text whose window closes while it waits is not sent', async () => {
  const company = await sendingCompany('wa-recheck-window');
  const record = await clientWith(company.agent, RESERVED.held);
  const { conversationId, message } = await started(company.agent, record);
  await reached(company.agent, conversationId, message.id, final, 100);
  const setInbound = (interval) =>
    query(`UPDATE inbox.crm_inbox_conversations SET last_inbound_at=now()-interval '${interval}'
      WHERE id='${conversationId}'`);
  setInbound('1 hour');
  const text = await reply(company.agent, conversationId, { body: 'Is Saturday fine?' });
  assert.equal(text.status, 201, JSON.stringify(text.value));
  await held(text.value.message.id);
  setInbound('24 hours');
  const settled = await reached(company.agent, conversationId, text.value.message.id, final, 100);
  assert.deepEqual([settled.status, settled.failureReason], ['failed', 'outside_window']);
  assert.deepEqual(
    (await attemptsOf(text.value.message.id)).map((item) => item.answer),
    [429],
  );
});

test('an odd sender list after 63007 leaves the number active (L1)', async () => {
  const company = await sendingCompany('wa-recheck-odd');
  const senders = company.phones.map((value) => ({ phone: value, status: 'ONLINE' }));
  const odd = await fetch(`${twilio}/test/senders?sid=${company.sid}&shape=empty`, {
    method: 'POST',
    body: JSON.stringify(senders),
  });
  assert.equal(odd.status, 200);
  const lists = async () =>
    (await state()).calls.filter((call) => call === 'GET /v2/Channels/Senders').length;
  const before = await lists();
  const record = await clientWith(company.agent);
  const { conversationId, message } = await started(company.agent, record);
  const failed = await reached(company.agent, conversationId, message.id, final);
  assert.deepEqual([failed.status, failed.failureReason], ['failed', 'number_not_set_up']);
  for (let tries = 0; tries < 50 && (await lists()) === before; tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok((await lists()) > before, 'the worker read the sender list again');
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.ok(stored(company.agentNumber.id).startsWith('active'));
});
