import assert from 'node:assert/strict';
import { test } from 'node:test';
import { channelPath } from './channels-helpers.mjs';
import { query } from './helpers.mjs';
import { numberEvents, revoke, setSenders, stored } from './whatsapp-helpers.mjs';
import {
  again,
  clientWith,
  RESERVED,
  reached,
  sendingCompany,
  sentTo,
  started,
} from './whatsapp-send-helpers.mjs';

// What Twilio's answers mean (W1b, docs/whatsapp-design.md §5 and §11), with the stand-in's
// reserved +999 recipients. Twilio has no send idempotency, so `unknown` is never re-sent.
const company = await sendingCompany('wa-failures');
const attempts = (message) =>
  query(`SELECT count(*)||'|'||string_agg(j.state,',') FROM outbox.crm_outbox_attempts a
    JOIN outbox.crm_outbox_jobs j ON j.id=a.job_id WHERE j.object_id='${message}'`);
const final = ['sent', 'delivered', 'read', 'failed', 'unknown'];

test('a number that is not on WhatsApp fails by callback and can be sent again once', async () => {
  const record = await clientWith(company.agent, RESERVED.notOnWhatsapp);
  const { conversationId, message } = await started(company.agent, record);
  const failed = await reached(company.agent, conversationId, message.id, ['failed']);
  assert.equal(failed.failureReason, 'not_on_whatsapp');
  const repeat = await again(company.agent, conversationId, message.id);
  assert.equal(repeat.status, 201, JSON.stringify(repeat.value));
  assert.equal(repeat.value.message.repeatOf, message.id);
  assert.equal(repeat.value.message.template, message.template);
  assert.equal((await again(company.agent, conversationId, message.id)).status, 400);
  assert.equal((await again(company.admin, conversationId, repeat.value.message.id)).status, 400);
});

test('a refusal outside the window fails at once with its reason', async () => {
  const record = await clientWith(company.agent, RESERVED.outsideWindow);
  const { conversationId, message } = await started(company.agent, record);
  const failed = await reached(company.agent, conversationId, message.id, final);
  assert.deepEqual([failed.status, failed.failureReason], ['failed', 'outside_window']);
  assert.equal(attempts(message.id), '1|failed');
});

test('a rate limit before acceptance is retried, then sent', async () => {
  const record = await clientWith(company.agent, RESERVED.limited);
  const { conversationId, message } = await started(company.agent, record);
  const done = await reached(company.agent, conversationId, message.id, ['read']);
  assert.equal(done.failureReason, null);
  const answers = (await sentTo(RESERVED.limited)).map((item) => item.answer);
  assert.deepEqual(answers, [429, 201]);
  assert.equal(attempts(message.id), '2|done,done');
});

test('a timeout is unknown, never re-sent; only a person sends it again', async () => {
  const record = await clientWith(company.agent, RESERVED.timeout);
  const { conversationId, message } = await started(company.agent, record);
  const unknown = await reached(company.agent, conversationId, message.id, final, 150);
  assert.deepEqual([unknown.status, unknown.failureReason], ['unknown', 'provider_unclear']);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  assert.equal((await sentTo(RESERVED.timeout)).length, 1);
  assert.equal(attempts(message.id), '1|unknown');
  const repeat = await again(company.agent, conversationId, message.id);
  assert.equal(repeat.status, 201, JSON.stringify(repeat.value));
});

test('a number Twilio no longer lists for the account fails and is disconnected (L3)', async () => {
  // Its own company, so no send still in flight from another case meets the new list.
  const moved = await sendingCompany('wa-failures-moved');
  const { sid, phones, agentNumber, admin, agent } = moved;
  await setSenders(
    sid,
    [phones[0], phones[2]].map((phone) => ({ phone, status: 'ONLINE' })),
  );
  const before = numberEvents(admin.user.workspaceId, 'number_disconnected');
  const record = await clientWith(agent);
  const { conversationId, message } = await started(agent, record);
  const failed = await reached(agent, conversationId, message.id, final);
  assert.deepEqual([failed.status, failed.failureReason], ['failed', 'number_not_set_up']);
  for (let tries = 0; tries < 50 && stored(agentNumber.id).startsWith('active'); tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.equal(stored(agentNumber.id), 'disconnected|2');
  assert.equal(
    Number(numberEvents(admin.user.workspaceId, 'number_disconnected')),
    Number(before) + 1,
  );
  // The Admin's number is still listed, so it stays.
  assert.ok(stored(moved.adminNumber.id).startsWith('active'));
});

test('a refused token fails the send and marks the company account for reconnecting', async () => {
  const { admin, sid } = company;
  const record = await clientWith(admin);
  await revoke(sid);
  const { conversationId, message } = await started(admin, record);
  const failed = await reached(admin, conversationId, message.id, final);
  assert.deepEqual([failed.status, failed.failureReason], ['failed', 'account_reconnect']);
  const channels = (await admin.request(channelPath(admin))).value.channels;
  assert.equal(channels.find((item) => item.provider === 'twilio').state, 'reconnect_required');
  const next = await clientWith(admin);
  const view = (
    await admin.request(
      `/workspaces/${admin.user.workspaceId}/inbox/whatsapp/start?collection=Clients&recordId=${next.id}`,
    )
  ).value;
  assert.equal(view.refusal, 'account_reconnect');
});
