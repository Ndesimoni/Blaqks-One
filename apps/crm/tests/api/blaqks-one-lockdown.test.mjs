// BO1a access lockdown (docs/blaqks-one-console.md §6): Blaqks One reaches no company
// data and no CRM in its own organisation, while companies keep their own access.
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { create, login, query } from './helpers.mjs';
import { newCompany } from './company-helpers.mjs';
import { activate, invite } from './team-helpers.mjs';

const ORGANISATION = 'super-admin-workspace';
let owner, admin, staff, client;

before(async () => {
  query('TRUNCATE crm_login_limits');
  ({ owner, admin } = await newCompany('lockdown'));
  staff = await activate(await invite(admin, 'lockdown-staff'));
  client = await create(admin, 'Clients', { client_id: 'LOCK-CLIENT', full_name: 'Zqx Lockdown' });
});

/** Every data family under a workspace: `[method, path, body]`, `$id` for a record. */
const data = [
  ['GET', '/records'],
  ['POST', '/records/Clients', { record: { client_id: 'LOCK-FORGED' } }],
  ['PATCH', '/records/Clients/$id', { version: 1, record: { client_id: 'LOCK-CLIENT' } }],
  ['DELETE', '/records/Clients/$id', { version: 1 }],
  ['GET', '/records/Properties/$id/files/photo'],
  ['GET', '/assignees?collection=Clients'],
  ['PUT', '/records/Clients/$id/assignee', { version: 1, assigneeId: null }],
  ['GET', '/records/Clients/$id/assignments'],
  ['POST', '/assignments/bulk', { collection: 'Clients', items: [] }],
  ['GET', '/finance'],
  ['POST', '/finance/deals', {}],
  ['GET', '/performance/targets'],
];
const feed = [['GET', '/activity']];
const team = [
  ['GET', '/team'],
  ['GET', '/team?archived=true'],
];
const imports = [
  ['POST', '/imports/preview', { sourceWorkspaceId: ORGANISATION, records: {} }],
  ['POST', '/imports/commit', { token: 'x'.repeat(43) }],
];

/** Families refused before BO1a, kept as regressions (T5). */
const refusedBefore = [
  ['POST', '/media', {}],
  ['GET', '/shares'],
  ['GET', '/inbox/conversations'],
  ['GET', '/inbox/summary'],
  ['GET', '/inbox/rules'],
  ['GET', '/chat'],
  ['GET', '/agreements'],
  ['GET', '/agreements/listing-shares'],
  ['GET', '/channels'],
  ['GET', '/mailbox'],
  ['GET', '/email-addresses'],
  ['GET', '/whatsapp-numbers'],
  ['GET', '/website'],
  ['GET', '/website/draft'],
  ['GET', '/website/enquiries'],
  ['GET', '/website/profiles'],
  ['GET', '/marketplace/status'],
  ['GET', '/marketplace/requests/mine'],
];

async function refused(session, workspace, list, label) {
  for (const [method, tail, body] of list) {
    const path = `/workspaces/${workspace}${tail.replace('$id', client.id)}`;
    const result = await session.request(path, { method, body });
    assert.ok([403, 404].includes(result.status), `${label} ${method} ${path}: ${result.status}`);
    assert.doesNotMatch(JSON.stringify(result.value), /Zqx Lockdown|LOCK-CLIENT/);
  }
}

test('Blaqks One is refused by every data family in a company workspace (T2, T5)', async () => {
  const before = query(`SELECT version FROM crm_records WHERE id='${client.id}'`);
  const all = [...data, ...feed, ...team, ...imports, ...refusedBefore];
  await refused(owner, admin.user.workspaceId, all, 'company');
  assert.equal(query(`SELECT version FROM crm_records WHERE id='${client.id}'`), before);
  assert.equal(query(`SELECT count(*) FROM crm_records WHERE legacy_id IN ('LOCK-FORGED')`), '0');
  const company = await owner.request(`/workspaces/${admin.user.workspaceId}/company`);
  assert.equal(company.status, 403);
});

test('the organisation holds no CRM and its leftover rows stay untouched (T3)', async () => {
  query(
    `INSERT INTO crm_records (id,workspace_id,collection,legacy_id,payload) VALUES
     (gen_random_uuid(),'${ORGANISATION}','Contacts','ORG-LEFTOVER',
     '{"contact_id":"ORG-LEFTOVER","full_name":"Zqx Leftover"}') ON CONFLICT DO NOTHING`,
  );
  const leftover = () =>
    query(`SELECT version||':'||payload::text FROM crm_records WHERE legacy_id='ORG-LEFTOVER'`);
  const kept = leftover();
  await refused(owner, ORGANISATION, [...data, ...imports, ...refusedBefore], 'Blaqks One');
  for (const session of [admin, staff])
    await refused(session, ORGANISATION, [...data, ...feed, ...team, ...imports], 'member');
  assert.equal(leftover(), kept);
  // Blaqks One keeps only its own team feed there (owner answer Q6).
  const own = await owner.request(`/workspaces/${ORGANISATION}/activity?kind=team`);
  assert.equal(own.status, 200, JSON.stringify(own.value));
  assert.ok(own.value.activity.every((item) => item.kind === 'team'));
  for (const kind of ['record', 'channel'])
    assert.equal(
      (await owner.request(`/workspaces/${ORGANISATION}/activity?kind=${kind}`)).status,
      403,
    );
  assert.equal((await admin.request(`/workspaces/${ORGANISATION}/activity`)).status, 403);
});

test('the Blaqks One profile carries no CRM permissions, actions or finance (T7)', async () => {
  const session = await owner.request('/auth/session');
  for (const user of [owner.user, session.value.user]) {
    assert.equal(user.role, 'Blaqks One');
    assert.equal(user.managesTeam, true);
    assert.ok(Object.values(user.permissions).every((grant) => grant === false));
    for (const actions of Object.values(user.recordActions))
      assert.ok(Object.values(actions).every((allowed) => allowed === false));
    assert.equal(user.financeAccess.scope, 'none');
    assert.equal(user.financeAccess.teamView, false);
  }
});

test('companies keep their own access and stay isolated from each other (T8)', async () => {
  const workspace = admin.user.workspaceId;
  const own = await admin.request(`/workspaces/${workspace}/records`);
  assert.equal(own.status, 200);
  assert.ok(own.value.records.Clients.some((entry) => entry.id === client.id));
  assert.equal((await admin.request(`/workspaces/${workspace}/activity`)).status, 200);
  assert.equal((await admin.request(`/workspaces/${workspace}/finance`)).status, 200);
  assert.equal((await admin.request(`/workspaces/${workspace}/team`)).status, 200);
  assert.equal((await staff.request(`/workspaces/${workspace}/records`)).status, 200);
  const directory = (await staff.request('/workspaces')).value.workspaces;
  assert.deepEqual(
    directory.map((entry) => entry.id),
    [workspace],
  );
  const other = await login('admin-b');
  await refused(other, workspace, [...data, ...feed, ...team, ...imports], 'other company');
  await refused(admin, other.user.workspaceId, [...data, ...feed, ...team], 'into other');
});
