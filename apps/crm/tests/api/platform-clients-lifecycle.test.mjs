// BO1e Blaqks One's own clients: stage and owner changes add timeline entries and events,
// a call or message is logged, stale versions are refused and archiving hides a client.
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';
import { teamMember } from './platform-team-helpers.mjs';
import { CLIENTS, addClient, listClients, ok, readClient } from './platform-clients-helpers.mjs';

let owner, sales;

before(async () => {
  query('TRUNCATE crm_login_limits');
  owner = await login('owner');
  sales = await teamMember(owner, 'platform-clients-lifecycle-sales', 'sales');
});

const patch = (session, id, body) => session.request(`${CLIENTS}/${id}`, { method: 'PATCH', body });
const log = (session, id, body) =>
  session.request(`${CLIENTS}/${id}/timeline`, { method: 'POST', body });
const events = (name) =>
  Number(query(`SELECT count(*) FROM platform_metrics.crm_platform_events WHERE event='${name}'`));

test('stage and owner changes, a logged call, stale versions and archiving', async () => {
  const added = await addClient(owner, 'lifecycle');
  const changed = events('client_stage_changed_contacted');
  const moved = ok(
    await patch(sales, added.id, { version: 1, stage: 'contacted', ownerId: sales.user.id }),
  ).client;
  assert.deepEqual(
    [moved.version, moved.stage, moved.ownerName],
    [2, 'contacted', sales.user.name],
  );
  assert.equal(events('client_stage_changed_contacted'), changed + 1);
  const stale = await patch(owner, added.id, { version: 1, stage: 'lost' });
  assert.deepEqual([stale.status, stale.value.code], [409, 'version_conflict']);
  const cleared = ok(
    await patch(owner, added.id, { version: 2, notes: null, nextFollowUp: null }),
  ).client;
  assert.deepEqual([cleared.version, cleared.notes, cleared.nextFollowUp], [3, null, null]);
  const entry = ok(
    await log(sales, added.id, { kind: 'call', body: 'Called about a demo.' }),
    201,
  ).entry;
  assert.deepEqual(Object.keys(entry).sort(), ['at', 'authorName', 'body', 'id', 'kind']);
  assert.deepEqual([entry.kind, entry.authorName], ['call', sales.user.name]);
  ok(await log(owner, added.id, { kind: 'whatsapp' }), 201);
  for (const body of [
    { kind: 'stage', body: 'x' },
    { kind: 'note' },
    { kind: 'note', body: 'x'.repeat(4001) },
  ]) {
    assert.equal((await log(owner, added.id, body)).status, 400, JSON.stringify(body));
  }
  ok(await patch(owner, added.id, { version: 3, ownerId: null }));
  const { client, timeline } = await readClient(owner, added.id);
  assert.equal(client.version, 4, 'logging leaves the version alone');
  assert.deepEqual(
    timeline.map((item) => [item.kind, item.body]),
    [
      ['assigned', 'Unassigned'],
      ['whatsapp', null],
      ['call', 'Called about a demo.'],
      ['assigned', `Assigned to ${sales.user.name}`],
      ['stage', 'New → Contacted'],
      ['created', null],
    ],
  );
  const remove = (version) =>
    owner.request(`${CLIENTS}/${added.id}`, { method: 'DELETE', body: { version } });
  assert.equal((await remove(3)).status, 409);
  assert.deepEqual(ok(await remove(4)), { archived: true });
  assert.equal((await owner.request(`${CLIENTS}/${added.id}`)).status, 404);
  assert.equal((await patch(owner, added.id, { version: 5, stage: 'lost' })).status, 404);
  assert.equal((await log(owner, added.id, { kind: 'call' })).status, 404);
  assert.ok(
    !(await listClients(owner, '?q=lifecycle')).clients.some((item) => item.id === added.id),
  );
});
