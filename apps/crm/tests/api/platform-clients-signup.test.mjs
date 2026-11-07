// BO1e sign-up link (docs/blaqks-one-console.md §9 and §11): when the verified public
// sign-up creates a company, a live client with the same email (any case) is linked to it
// and moves to Signed up, in the sign-up's own transaction.
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import { details, email, resetSignup, started, verify } from './signup-helpers.mjs';
import { CLIENTS, addClient, ok, readClient } from './platform-clients-helpers.mjs';

let owner;
const linkedEvents = () =>
  Number(
    query(`SELECT count(*) FROM platform_metrics.crm_platform_events WHERE event='client_linked'`),
  );

before(async () => {
  resetSignup();
  owner = await login('owner');
});

async function signUp(address) {
  const pending = await started(details({ email: address }));
  const created = await verify(pending.ticket);
  assert.equal(created.status, 201, JSON.stringify(created.value));
  return created.value.user;
}

test('a sign-up with a client email links the client and moves it to Signed up', async () => {
  const address = email('client-signup');
  const added = await addClient(owner, 'signup', {
    email: address.toUpperCase(),
    stage: 'demo_booked',
  });
  const other = await addClient(owner, 'signup-other');
  const before = linkedEvents();
  const user = await signUp(address);
  const { client, timeline } = await readClient(owner, added.id);
  assert.deepEqual(
    [client.stage, client.linkedCompany?.id, client.version],
    ['signed_up', user.workspaceId, 2],
  );
  assert.equal(typeof client.linkedCompany.name, 'string');
  assert.deepEqual(
    timeline.slice(0, 2).map((entry) => [entry.kind, entry.authorName]),
    [
      ['linked', null],
      ['stage', null],
    ],
  );
  assert.equal(timeline[1].body, 'Demo booked → Signed up');
  assert.equal(linkedEvents(), before + 1);
  const { sales } = ok(await owner.request('/platform/metrics')).totals;
  assert.ok(sales.becameCompanies >= 1 && sales.clients >= 2, 'the dashboard counts it');
  const listed = ok(
    await owner.request(`${CLIENTS}?stage=signed_up&q=${encodeURIComponent(address)}`),
  );
  assert.deepEqual(
    listed.clients.map((item) => item.id),
    [added.id],
  );
  const untouched = (await readClient(owner, other.id)).client;
  assert.deepEqual([untouched.stage, untouched.linkedCompany], ['new', null]);
});

test('archived clients and a sign-up without a matching client stay as they are', async () => {
  const address = email('client-archived');
  const added = await addClient(owner, 'archived', { email: address });
  const removed = await owner.request(`${CLIENTS}/${added.id}`, {
    method: 'DELETE',
    body: { version: 1 },
  });
  ok(removed);
  const before = linkedEvents();
  await signUp(address);
  await signUp(email('client-none'));
  assert.equal(linkedEvents(), before);
  assert.equal(
    query(
      `SELECT stage||'|'||(linked_workspace_id IS NULL)::text FROM ` +
        `platform_clients.crm_platform_clients WHERE id='${added.id}'`,
    ),
    'new|true',
  );
});
