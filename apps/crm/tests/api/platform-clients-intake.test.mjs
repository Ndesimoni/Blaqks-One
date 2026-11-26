// BO1e public intake (docs/blaqks-one-console.md §11): the marketing site's relay posts the
// contact form server to server. No session or browser origin; a hidden trap field, an
// email-or-phone rule, a body limit and per-sender and global budgets.
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import {
  contact,
  contactBody,
  listClients,
  readClient,
  storedWith,
} from './platform-clients-helpers.mjs';

let owner;
const RECEIVED = [202, { received: true }];
const answer = (response) => [response.status, response.value];
const events = () =>
  query(
    `SELECT count(*) FROM platform_metrics.crm_platform_events WHERE ` +
      `event='client_created_website_form' AND source='general_site' AND actor_role IS NULL`,
  );

before(async () => {
  query('TRUNCATE crm_login_limits');
  owner = await login('owner');
});

test('a message from the website becomes a new, unassigned client', async () => {
  const before = Number(events());
  const body = contactBody('intake-valid');
  assert.deepEqual(answer(await contact(body, '192.0.2.21')), RECEIVED);
  const { clients } = await listClients(owner, `?q=${encodeURIComponent(body.email)}`);
  assert.equal(clients.length, 1);
  const [found] = clients;
  assert.deepEqual(
    [found.source, found.stage, found.ownerId, found.companyName, found.contactName, found.phone],
    ['website_form', 'new', null, body.company, body.name, body.phone],
  );
  const { client, timeline } = await readClient(owner, found.id);
  assert.equal(client.createdByName, null);
  assert.deepEqual(
    timeline.map((entry) => [entry.kind, entry.body, entry.authorName]),
    [['created', body.message, null]],
  );
  assert.equal(Number(events()), before + 1);
  const emailOnly = contactBody('intake-email-only', { phone: '' });
  assert.deepEqual(answer(await contact(emailOnly, '192.0.2.21')), RECEIVED);
  const phoneOnly = contactBody('intake-phone-only', { email: '' });
  assert.deepEqual(answer(await contact(phoneOnly, '192.0.2.21')), RECEIVED);
  assert.equal(storedWith(emailOnly.email), '1');
  const byPhone = await listClients(owner, `?q=${encodeURIComponent(phoneOnly.company)}`);
  assert.equal(byPhone.clients[0].email, null);
});

test('the hidden trap answers the same and keeps nothing', async () => {
  const body = contactBody('intake-trap', { website: 'https://spam.example' });
  assert.deepEqual(answer(await contact(body, '192.0.2.22')), RECEIVED);
  assert.equal(storedWith(body.email), '0');
});

test('a message needs a name, an email or phone, and a sensible size', async () => {
  for (const changes of [
    { email: '', phone: '' },
    { name: '', company: '' },
    { phone: '0501234567' },
    { email: 'not-an-email' },
    { message: 'x'.repeat(4001) },
    { listing: 'x' },
  ]) {
    const body = contactBody('intake-invalid', changes);
    const refused = await contact(body, '192.0.2.23');
    assert.equal(refused.status, 400, JSON.stringify(changes));
    if (body.email) assert.equal(storedWith(body.email), '0');
  }
  assert.equal((await contact('{"name":', '192.0.2.23')).status, 400);
  const padded = contactBody('intake-huge');
  const huge = await contact(JSON.stringify(padded) + ' '.repeat(17 * 1024), '192.0.2.23');
  assert.equal(huge.status, 413);
  assert.equal(storedWith(padded.email), '0');
});

test('no browser origin, cookie or session is needed or used', async () => {
  const body = contactBody('intake-origin');
  const headers = { Origin: 'https://elsewhere.example', Cookie: 'kws_crm_session=forged' };
  assert.deepEqual(answer(await contact(body, '192.0.2.24', headers)), RECEIVED);
  assert.equal(storedWith(body.email), '1');
});

test('each sender and everyone together have a budget', async () => {
  for (let sent = 0; sent < 20; sent += 1) {
    const trap = contactBody('intake-budget', { website: 'filled' });
    assert.equal((await contact(trap, '192.0.2.25')).status, 202);
  }
  const over = contactBody('intake-budget-over');
  const limited = await contact(over, '192.0.2.25');
  assert.deepEqual([limited.status, limited.value?.code], [429, 'rate_limited']);
  assert.equal(storedWith(over.email), '0');
  assert.deepEqual(answer(await contact(contactBody('intake-other'), '192.0.2.26')), RECEIVED);
  query(
    `INSERT INTO crm_login_limits (key_hash,attempts,window_seconds) VALUES ` +
      `(encode(sha256('blaqks-one:contact:global'::bytea),'hex'),200,3600) ON CONFLICT (key_hash) ` +
      `DO UPDATE SET attempts=200,window_started=now(),window_seconds=3600`,
  );
  const everyone = contactBody('intake-global');
  assert.equal((await contact(everyone, '192.0.2.27')).status, 429);
  assert.equal(storedWith(everyone.email), '0');
  query('TRUNCATE crm_login_limits');
});
