import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canSendAgain,
  emailRecipients,
  replyState,
} from '../../src/features/server/inbox/composerModel.js';
import { returnedValues } from '../../src/features/server/mailbox/mailboxModel.js';

const admin = { id: 'u1', roleId: 'admin' };
const staff = { id: 'u2', roleId: 'staff', channelAccess: { email: false, whatsapp: true } };
const mailbox = { id: 'm1', state: 'connected', label: 'aidah@keys.example' };
const email = { channel: 'email', connectionId: 'm1' };

test('the composer sends email only through the conversation’s own mailbox (O9)', () => {
  const state = (overrides) =>
    replyState({ conversation: email, user: admin, mailbox, health: 'connected', ...overrides });
  assert.equal(state({}), 'send');
  assert.equal(state({ mailbox: null }), 'connectMailbox');
  assert.equal(state({ mailbox: { ...mailbox, state: 'reconnect_required' } }), 'reconnect');
  assert.equal(state({ conversation: { ...email, connectionId: 'm2' } }), 'otherMailbox');
  assert.equal(state({ user: staff }), 'noPermission');
  const whatsapp = { channel: 'whatsapp', connectionId: 'w1' };
  assert.equal(state({ conversation: whatsapp, user: staff }), 'comingSoon');
  assert.equal(state({ conversation: whatsapp, health: 'off' }), 'disconnected');
});

test('only the author’s own failed or unknown message may be sent again, once', () => {
  const failed = { id: 'a', direction: 'outbound', authorId: 'u1', status: 'failed' };
  const unknown = { ...failed, id: 'b', status: 'unknown' };
  const sent = { ...failed, id: 'c', status: 'sent' };
  assert.equal(canSendAgain(failed, [failed], 'u1'), true);
  assert.equal(canSendAgain(unknown, [unknown], 'u1'), true);
  assert.equal(canSendAgain(sent, [sent], 'u1'), false);
  assert.equal(canSendAgain(failed, [failed], 'u2'), false);
  const repeat = { id: 'd', repeatOf: 'a' };
  assert.equal(canSendAgain(failed, [failed, repeat], 'u1'), false);
});

test('New email offers only people with a usable address', () => {
  const entry = (id, name, mail) => ({ id, record: { full_name: name, email: mail } });
  const rows = emailRecipients(
    {
      Clients: [entry('1', 'Layla', 'layla@example.test'), entry('2', 'No Mail', '')],
      Contacts: [entry('3', 'Omar', 'not an address'), entry('4', 'Sara', 'sara@example.test')],
    },
    '',
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ['1', '4'],
  );
  assert.deepEqual(
    emailRecipients({ Clients: [entry('1', 'Layla', 'layla@example.test')] }, 'sara'),
    [],
  );
});

test('the Google return reads the fragment values once, without trusting extras', () => {
  assert.deepEqual(returnedValues('#/oauth/google?state=s1&code=4%2Fabc'), {
    state: 's1',
    code: '4/abc',
    error: null,
  });
  assert.deepEqual(returnedValues('#/oauth/google?error=denied'), {
    state: null,
    code: null,
    error: 'denied',
  });
});
