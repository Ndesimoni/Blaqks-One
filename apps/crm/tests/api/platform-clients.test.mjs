// BO1e Blaqks One's own clients: the Owner and a Sales member (clients at Manage) add,
// list and read clients with their timeline; every field is checked.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import { teamMember } from './platform-team-helpers.mjs';
import {
  CLIENTS,
  addClient,
  clientBody,
  listClients,
  readClient,
} from './platform-clients-helpers.mjs';

const SUMMARY =
  'companyName contactName email id linkedCompany nextFollowUp ownerId ownerName phone source stage updatedAt version';
const DETAIL = `${SUMMARY} createdAt createdByName notes`.split(' ').sort();
let owner, sales;

before(async () => {
  query('TRUNCATE crm_login_limits');
  owner = await login('owner');
  sales = await teamMember(owner, 'platform-clients-sales', 'sales');
});

const events = (name) =>
  Number(query(`SELECT count(*) FROM platform_metrics.crm_platform_events WHERE event='${name}'`));

test('the Owner and Sales add clients and read them with their timeline', async () => {
  const created = events('client_created_call');
  const added = await addClient(owner, 'owner-added', { ownerId: sales.user.id });
  assert.deepEqual(Object.keys(added).sort(), DETAIL);
  assert.equal(added.ownerName, sales.user.name);
  assert.equal(added.createdByName, owner.user.name);
  assert.deepEqual([added.stage, added.source, added.version], ['new', 'call', 1]);
  assert.deepEqual([added.linkedCompany, added.nextFollowUp], [null, '2026-12-01']);
  assert.equal(events('client_created_call'), created + 1);
  const { client, timeline } = await readClient(sales, added.id);
  assert.deepEqual(client, added);
  assert.deepEqual(
    timeline.map((entry) => [entry.kind, entry.authorName]),
    [['created', owner.user.name]],
  );
  const own = await addClient(sales, 'sales-added', {
    source: 'referral',
    phone: '',
    email: 'A@B.TEST',
  });
  assert.deepEqual([own.phone, own.email, own.ownerId], [null, 'a@b.test', null]);
  for (const changes of [
    { companyName: '', contactName: ' ' },
    { phone: null, email: '' },
    { phone: '0501234567' },
    { email: 'not-an-email' },
    { stage: 'won' },
    { source: 'website' },
    { notes: 'x'.repeat(4001) },
    { nextFollowUp: '2026-02-30' },
    { ownerId: randomUUID() },
    { listing: 'x' },
    { version: 1 },
  ]) {
    const refused = await owner.request(CLIENTS, {
      method: 'POST',
      body: clientBody('bad', changes),
    });
    assert.equal(refused.status, 400, JSON.stringify(changes));
  }
});

test('the list filters by stage, text and owner, counts each stage and pages', async () => {
  const tag = `filter-${randomUUID().slice(0, 8)}`;
  const a = await addClient(owner, `${tag}-a`, { ownerId: owner.user.id });
  const b = await addClient(owner, `${tag}-b`, { stage: 'demo_booked', ownerId: null });
  const c = await addClient(sales, `${tag}-c`, { stage: 'demo_booked', ownerId: sales.user.id });
  const ids = (page) => page.clients.map((item) => item.id);
  const all = await listClients(owner, `?q=${tag}&stage=all&owner=all`);
  assert.deepEqual(ids(all), [c.id, b.id, a.id]);
  assert.deepEqual(Object.keys(all.clients[0]).sort(), SUMMARY.split(' '));
  const counts = { new: 1, contacted: 0, demo_booked: 2, signed_up: 0, customer: 0, lost: 0 };
  assert.deepEqual([all.stageCounts, all.nextCursor], [counts, null]);
  const demo = await listClients(owner, `?q=${tag}&stage=demo_booked`);
  assert.deepEqual([ids(demo), demo.stageCounts], [[c.id, b.id], counts]);
  assert.deepEqual(ids(await listClients(sales, `?q=${tag}&owner=me`)), [c.id]);
  assert.deepEqual(ids(await listClients(owner, `?q=${tag.toUpperCase()}&owner=unassigned`)), [
    b.id,
  ]);
  const first = await listClients(owner, `?q=${tag}&limit=2`);
  assert.deepEqual(ids(first), [c.id, b.id]);
  const rest = await listClients(
    owner,
    `?q=${tag}&limit=2&cursor=${encodeURIComponent(first.nextCursor)}`,
  );
  assert.deepEqual([ids(rest), rest.nextCursor], [[a.id], null]);
  for (const search of [
    '?stage=won',
    '?owner=someone',
    '?limit=0',
    '?limit=101',
    '?cursor=x',
    '?other=1',
  ]) {
    assert.equal((await owner.request(`${CLIENTS}${search}`)).status, 400, search);
  }
});
