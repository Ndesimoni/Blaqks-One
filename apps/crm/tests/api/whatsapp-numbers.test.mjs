import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login } from './helpers.mjs';
import {
  give,
  given,
  numbersPath,
  phone,
  setSenders,
  whatsappCompany,
  whatsappStaff,
} from './whatsapp-helpers.mjs';

// Giving members their numbers (W1a, WQ3, docs/whatsapp-design.md §4 and §16).
const NOT_MEMBER = 'Choose an active member of your team who may use WhatsApp.';
const NOT_SENDER =
  'Choose a number that Twilio lists as an online WhatsApp sender of your account.';
let company;
let agent;
let colleague;
let ungranted;

before(async () => {
  company = await whatsappCompany('wa-numbers-admin', 4);
  agent = await whatsappStaff(company.admin, 'wa-numbers-agent');
  colleague = await whatsappStaff(company.admin, 'wa-numbers-colleague');
  ungranted = await whatsappStaff(company.admin, 'wa-numbers-ungranted', false);
});

test('the Admin gives each member with the grant one online number', async () => {
  const { admin, phones, offline } = company;
  const outsider = await login('admin-a');
  const owner = await login('owner');
  for (const member of [ungranted.user.id, outsider.user.id, owner.user.id]) {
    const refused = await give(admin, member, phones[0]);
    assert.equal(refused.status, 400);
    assert.equal(refused.value.message, NOT_MEMBER);
  }
  for (const number of [offline, phone(), 'not a phone']) {
    const refused = await give(admin, agent.user.id, number);
    assert.equal(refused.status, 400);
    assert.equal(refused.value.message, NOT_SENDER);
  }
  assert.equal((await give(agent, agent.user.id, phones[0])).status, 403);
  // The phone is matched in canonical form, however it is typed.
  const number = await given(admin, agent.user.id, phones[0].replace('+9997', '+999 7'));
  assert.deepEqual(Object.keys(number).sort(), [
    'createdAt',
    'id',
    'memberId',
    'phone',
    'state',
    'version',
  ]);
  assert.equal(number.phone, phones[0]);
  assert.equal(number.memberId, agent.user.id);
  assert.equal(number.state, 'active');
  assert.equal(number.version, 1);
  const second = await give(admin, agent.user.id, phones[1]);
  assert.equal(second.status, 409);
  assert.equal(
    second.value.message,
    'This member already has a WhatsApp number. Disconnect it first.',
  );
  const sameNumber = await give(admin, colleague.user.id, phones[0]);
  assert.equal(sameNumber.status, 409);
  assert.equal(sameNumber.value.message, 'This number is already connected.');
  // The Admin may give a number to themselves.
  assert.equal((await given(admin, admin.user.id, phones[1])).memberId, admin.user.id);
  const senders = (await admin.request(numbersPath(admin, '/senders'))).value.senders;
  assert.deepEqual(
    senders.map((sender) => sender.available),
    [false, false, true, true, false],
  );
});

test('a number active in another company is refused without naming that company', async () => {
  const other = await whatsappCompany('wa-numbers-other', 1);
  // The other company's Twilio account also lists the first company's given number.
  await setSenders(other.sid, [{ phone: company.phones[0], status: 'ONLINE' }]);
  const listed = await other.admin.request(numbersPath(other.admin, '/senders'));
  assert.deepEqual(listed.value.senders, [
    { phone: company.phones[0], status: 'ONLINE', available: false },
  ]);
  const taken = await give(other.admin, other.admin.user.id, company.phones[0]);
  assert.equal(taken.status, 409);
  assert.equal(taken.value.message, 'This number is already connected.');
  const text = JSON.stringify(taken.value);
  for (const hidden of [company.admin.user.workspaceId, 'wa-numbers-admin', agent.user.id]) {
    assert.ok(!text.includes(hidden), hidden);
  }
});
