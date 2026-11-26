import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
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

// Agreement to WhatsApp messages (WQ2, docs/whatsapp-design.md §3, §10 and §18).
const NO_PHONE =
  'This record has no number WhatsApp can use. Save it in international form, starting with + or 00.';
let company;
let ungranted;
const stop = { change: 'stopped' };
const restore = (reason) => ({ change: 'restored', reason });
const rows = (workspace, key) =>
  query(`SELECT string_agg(state||':'||source,',' ORDER BY recorded_at,id)
    FROM inbox.crm_inbox_consents WHERE workspace_id='${workspace}' AND contact_key='${key}'`);

before(async () => {
  company = await sendingCompany('wa-consent');
  ungranted = await agent(company.admin, 'wa-consent-ungranted', false);
});

test('agreement, STOP and restore follow who may do what', async () => {
  const { admin, agent: staff } = company;
  const number = phone();
  const record = await clientWith(staff, number);
  const fresh = (await startState(staff, record)).value;
  assert.deepEqual(fresh.consent, { state: 'none', source: null, at: null });
  assert.deepEqual([fresh.canStart, fresh.refusal], [false, 'no_agreement']);
  assert.equal(fresh.contact.phone, number);
  assert.equal(fresh.number.id, company.agentNumber.id);
  const agreed = await agree(staff, record, { change: 'agreed', source: 'in_person' });
  assert.equal(agreed.status, 200, JSON.stringify(agreed.value));
  assert.deepEqual(
    [agreed.value.consent.state, agreed.value.consent.source],
    ['opt_in', 'in_person'],
  );
  assert.equal((await agree(staff, record)).status, 200, 'repeating writes nothing');
  assert.equal((await startState(staff, record)).value.canStart, true);
  const workspace = admin.user.workspaceId;
  assert.equal(rows(workspace, number), 'opt_in:in_person');
  // The Admin records STOP; agreement now needs the Admin with a written reason.
  assert.equal((await agree(admin, record, stop)).value.consent.state, 'opt_out');
  const refused = await agree(staff, record);
  assert.deepEqual([refused.status, refused.value.code], [409, 'opted_out']);
  assert.equal((await agree(staff, record, restore('Client called back.'))).status, 403);
  for (const reason of ['', '   ', 'x'.repeat(501)]) {
    assert.equal((await agree(admin, record, restore(reason))).status, 400);
  }
  assert.equal((await agree(admin, record, { change: 'restored' })).status, 400);
  const restored = await agree(admin, record, restore('  Client asked again by phone.  '));
  assert.equal(restored.value.consent.source, 'admin_restored');
  const twice = await agree(admin, record, restore('Again.'));
  assert.deepEqual([twice.status, twice.value.code], [409, 'not_stopped']);
  assert.equal(
    rows(workspace, number),
    'opt_in:in_person,opt_out:recorded_stop,opt_in:admin_restored',
  );
  const reason = query(`SELECT reason FROM inbox.crm_inbox_consents
    WHERE workspace_id='${workspace}' AND source='admin_restored' AND contact_key='${number}'`);
  assert.equal(reason, 'Client asked again by phone.');
  assert.throws(() => query(`UPDATE inbox.crm_inbox_consents SET state='opt_in'`), /insert-only/);
  assert.throws(() => query(`DELETE FROM inbox.crm_inbox_consents`), /insert-only/);
  assert.throws(() => query(`TRUNCATE inbox.crm_inbox_consents`), /insert-only/);
});

test('staff without the grant may record STOP but not agreement', async () => {
  const number = phone();
  const record = await clientWith(ungranted, number);
  assert.equal((await agree(ungranted, record)).status, 403);
  const stopped = await agree(ungranted, record, stop);
  assert.equal(stopped.status, 200, JSON.stringify(stopped.value));
  assert.equal(stopped.value.consent.state, 'opt_out');
  assert.equal((await agree(ungranted, record, stop)).status, 200);
  assert.equal(rows(company.admin.user.workspaceId, number), 'opt_out:recorded_stop');
  const state = (await startState(ungranted, record)).value;
  assert.deepEqual([state.canStart, state.refusal], [false, 'no_grant']);
});

test('consent is keyed by the canonical number, not the record', async () => {
  const number = phone();
  const first = await clientWith(company.agent, number);
  const second = await clientWith(company.agent, number.replace('+9997', '+999 7'));
  assert.equal((await agree(company.agent, first, stop)).status, 200);
  const state = (await startState(company.agent, second)).value;
  assert.deepEqual([state.consent.state, state.refusal], ['opt_out', 'opted_out']);
  const noPhone = await clientWith(company.agent, 'not a phone');
  const missing = await agree(company.agent, noPhone);
  assert.equal(missing.status, 400);
  assert.equal(missing.value.message, NO_PHONE);
  assert.equal((await startState(company.agent, noPhone)).value.refusal, 'no_phone');
});

test('a conversation’s consent follows its visibility; others are refused', async () => {
  const record = await clientWith(company.agent);
  const { conversationId } = await started(company.agent, record);
  const stopped = await threadConsent(company.admin, conversationId, stop);
  assert.equal(stopped.status, 200, JSON.stringify(stopped.value));
  const view = (await read(company.agent, conversationId)).conversation.whatsapp;
  assert.deepEqual(
    [view.consent.state, view.refusal, view.canSend],
    ['opt_out', 'opted_out', false],
  );
  assert.equal((await threadConsent(company.agent, conversationId, { change: 'x' })).status, 400);
  const outsider = await login('admin-b');
  const foreign = await outsider.request(
    inbox(outsider, `/conversations/${conversationId}/consent`),
    {
      method: 'POST',
      body: stop,
    },
  );
  assert.equal(foreign.status, 404);
  const hidden = await clientWith(company.admin);
  assert.equal((await agree(company.agent, hidden)).status, 404);
  assert.equal((await agree(outsider, hidden)).status, 404);
  const owner = await login('owner');
  const path = `/workspaces/${company.admin.user.workspaceId}/inbox/whatsapp/consent`;
  const body = { collection: 'Clients', recordId: record.id, ...stop };
  assert.equal((await owner.request(path, { method: 'POST', body })).status, 403);
});
