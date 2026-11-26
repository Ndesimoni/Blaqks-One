import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import {
  agent,
  agree,
  clientWith,
  inbox,
  offered,
  read,
  reply,
  sendingCompany,
  start,
  started,
} from './whatsapp-send-helpers.mjs';

// Who may send on WhatsApp, and what is refused (W1b, docs/whatsapp-design.md §5 and §10).
let company;
let thread;
let record;
const code = (result) => [result.status, result.value?.code];

before(async () => {
  company = await sendingCompany('wa-guards');
  record = await clientWith(company.agent);
  thread = (await started(company.agent, record)).conversationId;
});

test('only a member with the grant sends, from their own number', async () => {
  const ungranted = await agent(company.admin, 'wa-guards-ungranted', false);
  const mine = await clientWith(ungranted);
  assert.equal((await start(ungranted, mine, { body: 'Hello' })).status, 403);
  const numberless = await agent(company.admin, 'wa-guards-numberless');
  const theirs = await clientWith(numberless);
  assert.deepEqual(code(await start(numberless, theirs, { body: 'Hi' })), [409, 'number_required']);
  // The Admin sees the agent's thread but it is on the agent's number.
  const view = (await read(company.admin, thread)).conversation.whatsapp;
  assert.deepEqual(
    [view.refusal, view.numberOwnerId, view.templates],
    ['other_number', company.agent.user.id, []],
  );
  const id = await offered(company.agent, record, 'new_listing');
  const template = { template: { id, variables: [] } };
  assert.deepEqual(code(await reply(company.admin, thread, template)), [409, 'other_number']);
});

test('templates need agreement, approval and valid variables', async () => {
  const fresh = await clientWith(company.agent);
  const id = await offered(company.agent, fresh, 'viewing_reminder');
  const send = (variables, templateId = id) =>
    start(company.agent, fresh, { template: { id: templateId, variables } });
  assert.deepEqual(code(await send(['Sara', 'Monday'])), [409, 'agreement_required']);
  assert.equal((await agree(company.agent, fresh)).status, 200);
  const VARIABLES =
    'Fill in each template variable: 1 to 200 characters, without line breaks, tabs or four spaces in a row.';
  for (const variables of [
    ['Sara'],
    ['Sara', 'Monday', 'extra'],
    ['Sara', 'line\nbreak'],
    ['Sara', 'tab\there'],
    ['Sara', 'four    spaces'],
    ['Sara', 'x'.repeat(201)],
    ['Sara', '   '],
    ['Sara', 7],
  ]) {
    const refused = await send(variables);
    assert.deepEqual(
      [refused.status, refused.value.message],
      [400, VARIABLES],
      JSON.stringify(variables),
    );
  }
  const listed = (
    await company.admin.request(`/workspaces/${company.admin.user.workspaceId}/whatsapp-templates`)
  ).value;
  const pending = listed.templates.find((item) => item.name === 'price_update').id;
  for (const unknown of [pending, `HX${'0'.repeat(32)}`]) {
    const refused = await send(['Sara'], unknown);
    assert.deepEqual(
      [refused.status, refused.value.message],
      [400, 'Choose an approved WhatsApp template.'],
    );
  }
  const files = await start(company.agent, fresh, {
    template: { id, variables: ['a', 'b'] },
    attachments: [crypto.randomUUID()],
  });
  assert.equal(files.value.message, 'Attachments are not available on WhatsApp yet.');
  assert.equal((await send(['Sara', 'Monday'])).status, 201);
});

test('free text is bounded, and STOP or a block stops every send', async () => {
  query(`UPDATE inbox.crm_inbox_conversations SET last_inbound_at=now() WHERE id='${thread}'`);
  const long = await reply(company.agent, thread, { body: 'x'.repeat(4097) });
  assert.deepEqual(
    [long.status, long.value.message],
    [400, 'Write a WhatsApp message of up to 4,096 characters.'],
  );
  const stopped = await clientWith(company.agent);
  await started(company.agent, stopped);
  assert.equal((await agree(company.agent, stopped, { change: 'stopped' })).status, 200);
  const id = await offered(company.agent, stopped, 'new_listing');
  const template = { template: { id, variables: [] } };
  assert.deepEqual(code(await start(company.agent, stopped, template)), [409, 'opted_out']);
  const blocked = (await read(company.admin, thread)).conversation;
  const block = await company.admin.request(
    inbox(company.admin, `/conversations/${thread}/block`),
    {
      method: 'POST',
      body: { expectedVersion: blocked.version },
    },
  );
  assert.equal(block.status, 200, JSON.stringify(block.value));
  assert.deepEqual(code(await reply(company.agent, thread, { body: 'Hello' })), [
    409,
    'not_sendable',
  ]);
  assert.equal((await read(company.agent, thread)).conversation.whatsapp.refusal, 'not_sendable');
});
