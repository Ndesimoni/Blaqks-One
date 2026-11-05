import assert from 'node:assert/strict';
import test from 'node:test';
import { staffMember } from './mailbox-helpers.mjs';
import { clientWith, settled, startMessage } from './mailbox-send-helpers.mjs';
import { addAddress, addressesPath, connectSendgrid, freshAdmin } from './sendgrid-helpers.mjs';

const remove = (session, address, expectedVersion = address.version) =>
  session.request(addressesPath(session, `/${address.id}/remove`), {
    method: 'POST',
    body: { expectedVersion },
  });

// Owner decision 2026-10-21: an address given by mistake may be removed while unused.
test('an unused address can be removed and its name given to someone else', async () => {
  const admin = await freshAdmin('sendgrid-remove-admin');
  const agent = await staffMember(admin, 'sendgrid-remove-agent', true);
  assert.equal((await connectSendgrid(admin, 'e3d-remove.example.test')).status, 201);
  const mistake = (await addAddress(admin, agent.user.id, 'aidah')).value.address;
  assert.equal((await remove(admin, mistake, mistake.version + 1)).status, 409, 'stale');
  assert.equal((await remove(agent, mistake)).status, 403, 'staff cannot remove');
  const rival = await freshAdmin('sendgrid-remove-rival');
  assert.equal((await remove(rival, mistake)).status, 404, 'another company');
  const removed = await remove(admin, mistake);
  assert.equal(removed.status, 200, JSON.stringify(removed.value));
  const mine = await addAddress(admin, admin.user.id, 'aidah', 'Aidah');
  assert.equal(mine.status, 201, 'the freed name goes to the right person');
  assert.equal((await addAddress(admin, agent.user.id, 'agent')).status, 201);
  // Once the address has been used with a client it is kept for ever.
  const client = await clientWith(admin, 'remove.client@example.test');
  const started = await startMessage(admin, client);
  assert.equal(started.status, 201, JSON.stringify(started.value));
  const { conversationId, message } = started.value;
  assert.equal((await settled(admin, conversationId, message.id)).status, 'sent');
  const used = await remove(admin, mine.value.address);
  assert.equal(used.status, 409);
  assert.match(used.value.message, /already been used with clients/);
});
