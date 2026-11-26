import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { patch } from './assignment-helpers.mjs';
import { phone } from './whatsapp-helpers.mjs';
import {
  agree,
  clientWith,
  offered,
  sendingCompany,
  start,
  startState,
} from './whatsapp-send-helpers.mjs';

// Which number a WhatsApp message goes to (W1b security review M1): international forms as
// written, a national form only as a UAE mobile, and the member confirms the number they
// were shown (`expectedPhone`). None of these numbers is ever sent to: every send here is
// refused, and the one that succeeds uses a +999 number.
const NO_PHONE =
  'This record has no number WhatsApp can use. Save it in international form, starting with + or 00.';
const CHANGED = "The client's number changed. Check it and try again.";
let company;
const refusal = (result) => [result.status, result.value?.code, result.value?.message];

before(async () => {
  company = await sendingCompany('wa-phone');
});

test('a national number is read only as a UAE mobile, which the member confirms', async () => {
  const { agent } = company;
  const record = await clientWith(agent, '50 000 0001');
  const state = (await startState(agent, record)).value;
  assert.equal(state.contact.phone, '+971500000001');
  for (const expectedPhone of [undefined, '+966500000001', '500000001', '']) {
    const refused = await agree(agent, record, {
      change: 'agreed',
      source: 'phone',
      expectedPhone,
    });
    assert.deepEqual(refusal(refused), [409, 'phone_changed', CHANGED], String(expectedPhone));
  }
  const agreed = await agree(agent, record, {
    change: 'agreed',
    source: 'phone',
    expectedPhone: '+971500000001',
  });
  assert.equal(agreed.status, 200, JSON.stringify(agreed.value));
  assert.equal(agreed.value.phone, '+971500000001');
  const id = await offered(agent, record, 'new_listing');
  const template = { template: { id, variables: [] } };
  for (const expectedPhone of [undefined, '+966500000001']) {
    const refused = await start(agent, record, { ...template, expectedPhone });
    assert.deepEqual(refusal(refused), [409, 'phone_changed', CHANGED]);
  }
});

test('a landline or other national form needs the international number', async () => {
  const { agent } = company;
  for (const typed of ['4 123 4567', '04 123 4567', '0612345678']) {
    const record = await clientWith(agent, typed);
    const state = (await startState(agent, record)).value;
    assert.deepEqual([state.contact, state.refusal, state.canStart], [null, 'no_phone', false]);
    const refused = await agree(agent, record, { change: 'agreed', source: 'phone' });
    assert.deepEqual([refused.status, refused.value.message], [400, NO_PHONE], typed);
    const id = await offered(agent, record, 'new_listing');
    const sent = await start(agent, record, { template: { id, variables: [] } });
    assert.deepEqual([sent.status, sent.value.message], [400, NO_PHONE], typed);
  }
});

test('international forms are taken as written', async () => {
  const { agent } = company;
  for (const [typed, key] of [
    ['+966 50 000 0001', '+966500000001'],
    ['00966 50 000 0001', '+966500000001'],
    ['+971 0 50 000 0002', '+971500000002'],
  ]) {
    const record = await clientWith(agent, typed);
    assert.equal((await startState(agent, record)).value.contact.phone, key, typed);
    const stopped = await agree(agent, record, { change: 'stopped' });
    assert.equal(stopped.value.phone, key);
  }
});

test('a number changed after the member saw it is refused, never sent', async () => {
  const { agent } = company;
  const first = phone();
  const record = await clientWith(agent, first);
  assert.equal((await agree(agent, record)).status, 200);
  const id = await offered(agent, record, 'new_listing');
  const changed = await patch(agent, 'Clients', record, { ...record.record, phone: phone() });
  assert.equal(changed.status, 200, JSON.stringify(changed.value));
  const refused = await start(agent, record, {
    template: { id, variables: [] },
    expectedPhone: first,
  });
  assert.deepEqual(refusal(refused), [409, 'phone_changed', CHANGED]);
  const sent = await start(agent, record, { template: { id, variables: [] } });
  assert.equal(sent.status, 409, 'the new number has no agreement yet');
  assert.equal(sent.value.code, 'agreement_required');
});
