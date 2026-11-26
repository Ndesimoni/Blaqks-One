import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { feed } from './activity-helpers.mjs';
import { login, query, request } from './helpers.mjs';
import {
  disconnectNumber,
  given,
  numberEvents,
  numbersPath,
  stored,
  whatsappCompany,
  whatsappStaff,
} from './whatsapp-helpers.mjs';

// Who sees and disconnects members' numbers (W1a, docs/whatsapp-design.md §10 and §16).
let company;
let agent;
let colleague;
let ungranted;

before(async () => {
  company = await whatsappCompany('wa-access-admin', 3);
  const { admin, phones } = company;
  agent = await whatsappStaff(admin, 'wa-access-agent');
  colleague = await whatsappStaff(admin, 'wa-access-colleague');
  ungranted = await whatsappStaff(admin, 'wa-access-ungranted', false);
  await given(admin, agent.user.id, phones[0]);
  await given(admin, admin.user.id, phones[1]);
});

test('staff list only their own number; the Admin lists every active number', async () => {
  const { admin } = company;
  const all = (await admin.request(numbersPath(admin))).value.numbers;
  assert.deepEqual(
    all.map((number) => number.memberId).sort(),
    [agent.user.id, admin.user.id].sort(),
  );
  const own = (await agent.request(numbersPath(agent))).value.numbers;
  assert.deepEqual(
    own.map((number) => number.memberId),
    [agent.user.id],
  );
  for (const session of [colleague, ungranted]) {
    assert.deepEqual((await session.request(numbersPath(session))).value, { numbers: [] });
  }
  for (const session of [await login('owner'), await login('admin-a')]) {
    assert.equal((await session.request(numbersPath(admin))).status, 403);
  }
});

test('a member disconnects their own number and the Admin any, by version', async () => {
  const { admin, phones } = company;
  const [mine] = (await agent.request(numbersPath(agent))).value.numbers;
  const all = (await admin.request(numbersPath(admin))).value.numbers;
  const admins = all.find((number) => number.memberId === admin.user.id);
  assert.equal((await disconnectNumber(colleague, mine)).status, 404);
  assert.equal((await disconnectNumber(agent, admins)).status, 404);
  const path = numbersPath(agent, `/${mine.id}/disconnect`);
  const owner = await login('owner');
  const byOwner = await owner.request(path, { method: 'POST', body: { expectedVersion: 1 } });
  assert.equal(byOwner.status, 403);
  const stale = await disconnectNumber(agent, mine, 7);
  assert.equal(stale.status, 409);
  assert.equal(stale.value.code, 'version_conflict');
  const noCsrf = await request(path, {
    method: 'POST',
    cookie: agent.cookie,
    body: { expectedVersion: 1 },
  });
  assert.equal(noCsrf.status, 403);
  const off = await disconnectNumber(agent, mine);
  assert.equal(off.status, 200, JSON.stringify(off.value));
  assert.equal(off.value.number.state, 'disconnected');
  assert.equal(off.value.number.version, 2);
  const again = await disconnectNumber(agent, off.value.number);
  assert.equal(again.status, 200);
  assert.equal(again.value.number.version, 2);
  assert.equal(stored(mine.id), 'disconnected|2');
  assert.equal((await disconnectNumber(admin, admins)).status, 200);
  assert.deepEqual((await admin.request(numbersPath(admin))).value, { numbers: [] });
  // A disconnected number keeps its history and may be given again.
  assert.equal((await given(admin, colleague.user.id, phones[0])).phone, phones[0]);
});

test('number events are redacted: no phone, member or token', async () => {
  const workspace = company.admin.user.workspaceId;
  assert.equal(numberEvents(workspace, 'number_connected'), '3');
  assert.equal(numberEvents(workspace, 'number_disconnected'), '2');
  const rows = query(`SELECT coalesce(string_agg(row_to_json(e)::text,' '),'')
    FROM integrations.crm_integration_events e WHERE workspace_id='${workspace}'`);
  const digits = company.phones.map((value) => value.slice(1));
  for (const hidden of [...digits, company.sid, colleague.user.id]) {
    assert.ok(!rows.includes(hidden), hidden);
  }
  const { activity } = await feed(company.admin, workspace, { kind: 'channel', limit: '100' });
  const actions = new Set(activity.map((item) => item.action));
  assert.ok(actions.has('number_connected') && actions.has('number_disconnected'));
  const text = JSON.stringify(activity);
  for (const hidden of digits) assert.ok(!text.includes(hidden), hidden);
});
