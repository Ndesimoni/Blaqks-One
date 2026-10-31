import assert from 'node:assert/strict';
import test from 'node:test';
import {
  availableSenders,
  ownNumber,
  twilioBody,
  twilioProblems,
  whatsappMembers,
} from '../../src/features/server/channels/whatsappModel.js';

// W1a (docs/whatsapp-design.md §16): the browser mirrors the server's Twilio shape checks.
const sid = `AC${'0123456789abcdef'.repeat(2)}`;
const token = 'f'.repeat(32);

test('a Twilio account needs a label, an AC Account SID and a 32-hex Auth Token', () => {
  assert.deepEqual(twilioProblems({ label: 'Line', sid, token }, true), {
    label: '',
    sid: '',
    token: '',
  });
  assert.deepEqual(twilioProblems({ label: ' ', sid: '', token: '' }, true), {
    label: 'whatsappAccount.labelRequired',
    sid: 'whatsappAccount.sidRequired',
    token: 'whatsappAccount.tokenRequired',
  });
  for (const bad of [
    'AC123',
    `ac${sid.slice(2)}`,
    `AC${'A'.repeat(32)}`,
    `${sid}0`,
    `SK${sid.slice(2)}`,
  ])
    assert.equal(
      twilioProblems({ label: 'x', sid: bad, token }, true).sid,
      'whatsappAccount.sidInvalid',
      bad,
    );
  for (const bad of [
    'f'.repeat(31),
    'f'.repeat(33),
    'g'.repeat(32),
    'F'.repeat(32),
    'f f'.repeat(11),
  ])
    assert.equal(
      twilioProblems({ label: 'x', sid, token: bad }, true).token,
      'whatsappAccount.tokenInvalid',
      bad,
    );
  assert.equal(twilioProblems({ label: 'x', sid: ` ${sid} `, token: ` ${token} ` }, true).sid, '');
});

test('reconnecting asks only for the new token and keeps the account', () => {
  assert.deepEqual(twilioProblems({ token }, false), { label: '', sid: '', token: '' });
  assert.equal(twilioProblems({ token: 'nope' }, false).token, 'whatsappAccount.tokenInvalid');
  assert.deepEqual(twilioBody({ sid: 'ignored', token: ` ${token}` }, { version: 4 }), {
    expectedVersion: 4,
    credential: token,
  });
  assert.deepEqual(twilioBody({ label: ' Company WhatsApp ', sid: ` ${sid}`, token }, null), {
    channel: 'whatsapp',
    provider: 'twilio',
    label: 'Company WhatsApp',
    externalAccountId: sid,
    credential: token,
  });
});

test('only live members with the WhatsApp grant, or the Admin, without a number are offered', () => {
  const members = [
    { id: 'admin', status: 'active', roleId: 'admin' },
    { id: 'b', status: 'active', roleId: 'staff', channelAccess: { whatsapp: true } },
    { id: 'c', status: 'active', roleId: 'staff', channelAccess: { email: true } },
    { id: 'd', status: 'inactive', roleId: 'staff', channelAccess: { whatsapp: true } },
    { id: 'e', status: 'invited', roleId: 'staff', channelAccess: { whatsapp: true } },
    { id: 'f', status: 'active', roleId: 'staff', channelAccess: { whatsapp: true } },
  ];
  const numbers = [
    { id: 'n1', memberId: 'f', phone: '+999500000001', state: 'active' },
    { id: 'n0', memberId: 'b', phone: '+999500000009', state: 'disconnected' },
  ];
  const ids = whatsappMembers(members, numbers).map((member) => member.id);
  assert.deepEqual(ids, ['admin', 'b']);
  assert.deepEqual(whatsappMembers([], numbers), []);
});

test('only online senders that no company holds are offered', () => {
  const senders = [
    { phone: '+999500000001', status: 'ONLINE', available: true },
    { phone: '+999500000002', status: 'OFFLINE', available: false },
    { phone: '+999500000003', status: 'ONLINE', available: false },
    { phone: '+999500000004', status: 'ONLINE', available: true },
  ];
  const numbers = [{ id: 'n1', memberId: 'a', phone: '+999500000004', state: 'active' }];
  assert.deepEqual(
    availableSenders(senders, numbers).map((sender) => sender.phone),
    ['+999500000001'],
  );
  assert.deepEqual(availableSenders([], numbers), []);
});

test('My WhatsApp shows only the member’s own active number', () => {
  const numbers = [
    { id: 'n1', memberId: 'a', phone: '+999500000001', state: 'disconnected' },
    { id: 'n2', memberId: 'b', phone: '+999500000002', state: 'active' },
    { id: 'n3', memberId: 'a', phone: '+999500000003', state: 'active' },
  ];
  assert.equal(ownNumber(numbers, 'a').id, 'n3');
  assert.equal(ownNumber(numbers, 'c'), null);
  assert.equal(ownNumber([], 'a'), null);
});
