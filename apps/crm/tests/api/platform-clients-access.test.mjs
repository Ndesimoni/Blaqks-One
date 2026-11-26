// BO1e access: the clients area decides (reads View, changes Manage, the Owner always);
// an Analyst, a company Admin and a signed-out caller reach nothing, and only the Owner and
// members with clients at Manage can hold a client.
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query, request } from './helpers.mjs';
import { newCompany } from './company-helpers.mjs';
import { teamMember } from './platform-team-helpers.mjs';
import { CLIENTS, addClient, clientRoutes, ok, readClient } from './platform-clients-helpers.mjs';

let owner, admin, analyst, viewer, manager;

before(async () => {
  query('TRUNCATE crm_login_limits');
  ({ owner, admin } = await newCompany('platform-clients-access'));
  analyst = await teamMember(owner, 'platform-clients-analyst', 'analyst');
  viewer = await teamMember(owner, 'platform-clients-viewer', 'custom', { clients: 'view' });
  manager = await teamMember(owner, 'platform-clients-manager', 'manager');
});

test('an Analyst, a company Admin and a signed-out caller are refused everywhere', async () => {
  const added = await addClient(owner, 'refused');
  for (const [label, session] of [
    ['analyst', analyst],
    ['admin', admin],
  ]) {
    for (const [, method, path, body] of clientRoutes(added.id)) {
      const { status } = await session.request(path, { method, body });
      assert.equal(status, 403, `${label} ${method} ${path}`);
    }
  }
  for (const [, method, path, body] of clientRoutes(added.id)) {
    assert.equal((await request(path, { method, body })).status, 401, `${method} ${path}`);
  }
  const { client, timeline } = await readClient(owner, added.id);
  assert.deepEqual([client.version, client.stage, timeline.length], [1, 'new', 1]);
});

test('clients at View reads every route and changes nothing', async () => {
  const added = await addClient(owner, 'viewed');
  for (const [level, method, path, body] of clientRoutes(added.id)) {
    const { status, value } = await viewer.request(path, { method, body });
    const label = `${method} ${path}: ${JSON.stringify(value)}`;
    assert.equal(status, level === 'view' ? 200 : 403, label);
  }
  assert.equal((await readClient(owner, added.id)).client.version, 1);
});

test('only the Owner and members with clients at Manage can hold a client', async () => {
  const sales = await teamMember(owner, 'platform-clients-access-sales', 'sales');
  const { owners } = ok(await viewer.request(`${CLIENTS}/owners`));
  const ids = owners.map((person) => person.id);
  for (const person of [owner, manager, sales]) assert.ok(ids.includes(person.user.id));
  for (const person of [viewer, analyst, admin]) assert.ok(!ids.includes(person.user.id));
  assert.deepEqual(Object.keys(owners[0]).sort(), ['id', 'name']);
  const added = await addClient(manager, 'assigned');
  for (const person of [viewer, admin]) {
    const body = { version: 1, ownerId: person.user.id };
    const refused = await manager.request(`${CLIENTS}/${added.id}`, { method: 'PATCH', body });
    assert.equal(refused.status, 400, JSON.stringify(refused.value));
  }
  const body = { version: 1, ownerId: sales.user.id };
  const given = ok(await manager.request(`${CLIENTS}/${added.id}`, { method: 'PATCH', body }));
  assert.equal(given.client.ownerName, sales.user.name);
  const forged = { method: 'PATCH', body: { version: 2, stage: 'lost' }, csrf: 'forged' };
  assert.equal((await manager.request(`${CLIENTS}/${added.id}`, forged)).status, 403);
});
