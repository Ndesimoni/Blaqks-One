import assert from 'node:assert/strict';
import test from 'node:test';
import { replyState, sendingMailbox } from '../../src/features/server/inbox/composerModel.js';

const admin = { id: 'u1', roleId: 'admin', channelAccess: { email: true } };
const email = { channel: 'email', connectionId: 'sg1' };

// E3d: a SendGrid company sends from each member's own address, never a Google mailbox.
test('a SendGrid company uses the member’s company address in the Inbox', () => {
  const google = { id: 'm1', state: 'connected', label: 'me@gmail.test' };
  assert.equal(sendingMailbox({ mailbox: google, companyEmail: null }), google);
  assert.equal(sendingMailbox(undefined), null);
  const company = (companyEmail) => sendingMailbox({ mailbox: google, companyEmail });
  const ready = company({ connectionId: 'sg1', connected: true, address: 'aidah@keys.test' });
  assert.deepEqual(ready, {
    company: true,
    id: 'sg1',
    state: 'connected',
    label: 'aidah@keys.test',
  });
  const state = (mailbox) =>
    replyState({ conversation: email, user: admin, mailbox, health: 'connected' });
  assert.equal(state(ready), 'send');
  assert.equal(
    state(company({ connectionId: 'sg1', connected: true, address: null })),
    'needAddress',
  );
  const bare = {
    mailbox: null,
    companyEmail: { connectionId: 'sg1', connected: true, address: null },
  };
  assert.equal(state(sendingMailbox(bare, true)), 'adminNeedsAddress');
  const attention = company({ connectionId: 'sg1', connected: false, address: 'aidah@keys.test' });
  assert.equal(state(attention), 'companyReconnect');
  // An older Google conversation cannot be answered from the company connection.
  const older = { channel: 'email', connectionId: 'm1' };
  assert.equal(
    replyState({ conversation: older, user: admin, mailbox: ready, health: 'connected' }),
    'otherMailbox',
  );
});
