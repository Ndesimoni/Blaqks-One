import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { phone } from './whatsapp-helpers.mjs';
import {
  agent,
  agree,
  clientWith,
  inbox,
  read,
  sendingCompany,
  startState,
  started,
  threadConsent,
} from './whatsapp-send-helpers.mjs';

// What a member learns from a client's consent and a thread's number (W1b security review
// L2 and L3): assigned-only staff see the state of a colleague's record, never how or when
// it was recorded; the Admin can trace every row to its record or conversation.
let company;
let colleague;
const via = (workspace, key) =>
  query(`SELECT string_agg(concat_ws(':',source,via_collection,via_record_id,via_conversation_id),
    ',' ORDER BY recorded_at,id) FROM inbox.crm_inbox_consents
    WHERE workspace_id='${workspace}' AND contact_key='${key}'`);

before(async () => {
  company = await sendingCompany('wa-consent-scope');
  colleague = await agent(company.admin, 'wa-consent-scope-colleague');
});

test('a colleague’s client shows its state only; the Admin traces every row', async () => {
  const { admin, agent: staff } = company;
  const number = phone();
  const mine = await clientWith(staff, number);
  const theirs = await clientWith(colleague, number);
  assert.equal((await agree(staff, mine)).status, 200);
  const own = (await startState(staff, mine)).value.consent;
  assert.deepEqual([own.state, own.source], ['opt_in', 'phone']);
  assert.ok(own.at);
  const seen = (await startState(colleague, theirs)).value.consent;
  assert.deepEqual(seen, { state: 'opt_in', source: null, at: null });
  const stopped = await agree(colleague, theirs, { change: 'stopped' });
  assert.deepEqual(
    stopped.value.consent.source,
    'recorded_stop',
    'the recorder sees their own row',
  );
  const later = (await startState(staff, mine)).value.consent;
  assert.deepEqual(later, { state: 'opt_out', source: null, at: null });
  const traced = (await startState(admin, mine)).value.consent;
  assert.equal(traced.source, 'recorded_stop');
  const workspace = admin.user.workspaceId;
  assert.equal(
    via(workspace, number),
    `phone:Clients:${mine.id},recorded_stop:Clients:${theirs.id}`,
  );
});

test('a conversation’s consent row names the conversation', async () => {
  const { admin, agent: staff } = company;
  const number = phone();
  const record = await clientWith(staff, number);
  const { conversationId } = await started(staff, record);
  const stopped = await threadConsent(admin, conversationId, { change: 'stopped' });
  assert.equal(stopped.status, 200, JSON.stringify(stopped.value));
  assert.equal(stopped.value.phone, number);
  const rows = via(admin.user.workspaceId, number);
  assert.equal(rows, `phone:Clients:${record.id},recorded_stop:${conversationId}`);
  // The agent did not record the STOP, and has assigned-only scope.
  const view = (await read(staff, conversationId)).conversation.whatsapp.consent;
  assert.deepEqual(view, { state: 'opt_out', source: null, at: null });
});

test('only the number’s own member and the Admin see a thread’s number', async () => {
  const { admin, agent: staff, adminNumber } = company;
  const record = await clientWith(admin);
  const { conversationId } = await started(admin, record);
  assert.equal(
    (await read(admin, conversationId)).conversation.whatsapp.numberPhone,
    adminNumber.phone,
  );
  const current = (await read(admin, conversationId)).conversation;
  const moved = await admin.request(inbox(admin, `/conversations/${conversationId}`), {
    method: 'PATCH',
    body: { expectedVersion: current.version, assigneeId: staff.user.id },
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.value));
  const view = (await read(staff, conversationId)).conversation.whatsapp;
  assert.deepEqual(
    [view.numberPhone, view.numberOwnerId, view.refusal],
    [null, admin.user.id, 'other_number'],
  );
  const theirs = await clientWith(staff);
  const own = (await started(staff, theirs)).conversationId;
  const mine = (await read(staff, own)).conversation.whatsapp;
  assert.equal(mine.numberPhone, company.agentNumber.phone);
});
