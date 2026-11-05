import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { companyBody, newCompany, putCompany } from './company-helpers.mjs';
import { activate, invite, teamPath } from './team-helpers.mjs';
import { archive, archiveReview } from './archive-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

const list = (session) => session.request('/platform/companies');

test('Blaqks One lists each company with its Admin, seats and marketplace state', async () => {
  const { owner, admin } = await newCompany('platform-list');
  const saved = await putCompany(admin, companyBody({ displayName: 'Synthetic Platform Homes' }));
  assert.equal(saved.status, 200);
  const result = await list(owner);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  const row = result.value.companies.find((entry) => entry.id === admin.user.workspaceId);
  assert.deepEqual(
    {
      name: row.name,
      admin: row.admin,
      status: row.status,
      seatsUsed: row.seatsUsed,
      seatLimit: row.seatLimit,
      marketplace: row.marketplace,
    },
    {
      name: 'Synthetic Platform Homes',
      admin: admin.user.name,
      status: 'active',
      seatsUsed: 1,
      seatLimit: 3,
      marketplace: 'not_applied',
    },
  );
  assert.match(row.createdOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Number.isInteger(row.version), 'the version a seat-limit change sends back');
  assert.equal(
    result.value.companies.some((entry) => entry.id === owner.user.workspaceId),
    false,
    "the platform's own workspace is not a company",
  );
  assert.doesNotMatch(JSON.stringify(result.value), /email|password|phone|csrf/i);
});

test('company Admins cannot read the platform company list', async () => {
  const { admin } = await newCompany('platform-refused');
  const result = await list(admin);
  assert.equal(result.status, 403);
});

test('Blaqks One lists, suspends and archives a company’s agents without opening it (T6)', async () => {
  const { owner, admin } = await newCompany('platform-agents');
  const agent = await activate(await invite(admin, 'platform-agent'));
  const pending = await invite(admin, 'platform-agent-pending');
  const path = `/platform/companies/${admin.user.workspaceId}/members`;
  const listed = await owner.request(path);
  assert.equal(listed.status, 200, JSON.stringify(listed.value));
  const byId = Object.fromEntries(listed.value.members.map((row) => [row.id, row]));
  assert.equal(listed.value.members[0].id, admin.user.id, 'the Admin comes first');
  assert.deepEqual(Object.keys(byId[agent.user.id]).sort(), [
    'email',
    'id',
    'lastActiveAt',
    'name',
    'positions',
    'role',
    'roleId',
    'status',
    'version',
  ]);
  assert.equal(byId[admin.user.id].role, 'Admin');
  assert.deepEqual(byId[agent.user.id].positions, ['Receptionist']);
  assert.equal(byId[agent.user.id].status, 'active');
  assert.match(byId[agent.user.id].lastActiveAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.equal(byId[pending.member.id].status, 'pending');
  assert.equal(byId[pending.member.id].lastActiveAt, null);
  assert.doesNotMatch(JSON.stringify(listed.value), /permission|actions|channel|scope|records/i);
  for (const [session, target] of [
    [admin, path],
    [agent, path],
    [owner, `/platform/companies/${owner.user.workspaceId}/members`],
    [owner, '/platform/companies/unknown-company/members'],
  ])
    assert.equal((await session.request(target)).status, 403, target);
  const active = (id, version, value, session = owner) =>
    session.request(`${path}/${id}/active`, { method: 'PUT', body: { version, active: value } });
  const forged = await owner.request(teamPath(admin, agent.user.id), {
    method: 'PATCH',
    body: { version: byId[agent.user.id].version, active: false },
  });
  assert.equal(forged.status, 403, 'never through the company’s own team route');
  assert.equal(
    (await active(agent.user.id, byId[agent.user.id].version, false, admin)).status,
    403,
  );
  const off = await active(agent.user.id, byId[agent.user.id].version, false);
  assert.equal(off.status, 200, JSON.stringify(off.value));
  assert.equal(off.value.member.status, 'suspended');
  assert.equal((await agent.request('/auth/session')).status, 401);
  assert.equal((await active(agent.user.id, byId[agent.user.id].version, true)).status, 409);
  const on = await active(agent.user.id, off.value.member.version, true);
  assert.equal(on.status, 200, JSON.stringify(on.value));
  assert.equal(on.value.member.status, 'active');
  const review = await archiveReview(owner, admin, { id: agent.user.id });
  assert.equal((await archive(owner, admin, review)).status, 200);
  const after = (await owner.request(path)).value.members;
  assert.equal(after.find((row) => row.id === agent.user.id).status, 'archived');
  const admins = await active(admin.user.id, byId[admin.user.id].version, false);
  assert.equal(admins.status, 200, JSON.stringify(admins.value));
  assert.equal(admins.value.member.status, 'suspended');
  assert.equal((await admin.request('/auth/session')).status, 401);
});
