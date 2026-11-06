import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login } from './helpers.mjs';
import { disconnectNumber, given } from './whatsapp-helpers.mjs';
import {
  clientWith,
  inbox,
  offered,
  read,
  reply,
  sendingCompany,
  startState,
  started,
} from './whatsapp-send-helpers.mjs';

// A thread belongs to its number row (W-M3), and no other company or Blaqks One reaches it
// (W1b, docs/whatsapp-design.md §5 and §10).
let company;
let thread;
let record;
const code = (result) => [result.status, result.value?.code];

before(async () => {
  company = await sendingCompany('wa-send-numbers');
  record = await clientWith(company.agent);
  thread = (await started(company.agent, record)).conversationId;
});

test('a disconnected number keeps its threads closed, even after a new number', async () => {
  const mine = await clientWith(company.agent);
  const { conversationId } = await started(company.agent, mine);
  const id = await offered(company.agent, mine, 'new_listing');
  const template = { template: { id, variables: [] } };
  assert.equal((await disconnectNumber(company.agent, company.agentNumber)).status, 200);
  assert.deepEqual(code(await reply(company.agent, conversationId, template)), [
    409,
    'number_required',
  ]);
  assert.equal(
    (await read(company.agent, conversationId)).conversation.whatsapp.refusal,
    'number_disconnected',
  );
  await given(company.admin, company.agent.user.id, company.phones[2]);
  assert.deepEqual(code(await reply(company.agent, conversationId, template)), [
    409,
    'number_disconnected',
  ]);
});

test('other companies and Blaqks One never reach a company’s WhatsApp', async () => {
  const outsider = await login('admin-b');
  const foreign = await outsider.request(inbox(outsider, `/conversations/${thread}/messages`), {
    method: 'POST',
    body: { body: 'Hello' },
  });
  assert.equal(foreign.status, 404);
  assert.equal((await startState(outsider, record)).status, 404);
  const owner = await login('owner');
  const path = `/workspaces/${company.admin.user.workspaceId}/inbox`;
  assert.equal((await owner.request(`${path}/conversations/${thread}`)).status, 403);
  assert.equal(
    (await owner.request(`${path}/whatsapp/start?collection=Clients&recordId=${record.id}`)).status,
    403,
  );
  const body = { channel: 'whatsapp', collection: 'Clients', recordId: record.id, body: 'Hi' };
  assert.equal(
    (await owner.request(`${path}/conversations`, { method: 'POST', body })).status,
    403,
  );
});
