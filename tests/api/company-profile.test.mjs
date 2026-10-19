import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import {
  companyBody,
  databaseFailure,
  emptyCompany,
  events,
  newCompany,
  putCompany,
  readCompany,
  snapshot,
} from './company-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('company details save, survive rereads, and name the directory without renaming identity', async () => {
  const { owner, admin, invitation } = await newCompany('profile');
  const workspace = admin.user.workspaceId;
  assert.deepEqual(await readCompany(admin), emptyCompany);
  const initial = events(workspace);
  assert.equal(initial.length, 1);
  assert.equal(initial[0].action, 'created');
  assert.equal(initial[0].actor_id, owner.user.id, 'inviter is the actual actor');
  assert.equal(initial[0].from_type, null);
  assert.equal(initial[0].to_type, 'brokerage');
  const directory = async () => (await owner.request('/workspaces')).value.workspaces;
  assert.equal((await directory()).find((row) => row.id === workspace).name, admin.user.name);
  const saved = await putCompany(admin, companyBody({ displayName: '  شركة تجريبية  ' }));
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
  const expected = {
    ...emptyCompany,
    displayName: 'شركة تجريبية',
    emirate: 'dubai',
    setupComplete: true,
    version: 2,
  };
  assert.deepEqual(saved.value, expected);
  assert.deepEqual(await readCompany(admin), expected);
  const rows = await directory();
  assert.equal(rows.find((row) => row.id === workspace).name, expected.displayName);
  assert.equal(rows.find((row) => row.id === owner.user.workspaceId).name, 'Super Admin workspace');
  assert.equal(
    query(`SELECT name FROM crm_users WHERE id='${admin.user.id}'`),
    invitation.member.name,
  );
  assert.equal(
    query(`SELECT origin FROM crm_company_profiles WHERE workspace_id='${workspace}'`),
    'operator',
  );
  const history = events(workspace);
  assert.deepEqual(
    history.map((row) => row.action),
    ['created', 'details_updated'],
  );
  assert.equal(history[1].actor_id, admin.user.id);
  assert.equal(history[1].from_type, null);
  assert.equal(history[1].to_type, null);
  assert.deepEqual(
    Object.keys(history[1]).sort(),
    ['id', 'workspace_id', 'actor_id', 'action', 'from_type', 'to_type', 'created_at'].sort(),
  );
  assert.doesNotMatch(JSON.stringify(history), /شركة|تجريبية|dubai|@|Team123/);
  for (const statement of [
    `UPDATE crm_company_events SET action='created' WHERE workspace_id='${workspace}'`,
    `DELETE FROM crm_company_events WHERE workspace_id='${workspace}'`,
    'TRUNCATE crm_company_events',
  ])
    assert.match(databaseFailure(statement), /immutable|append.only/i);
  assert.deepEqual(events(workspace), history);
});

test('invalid and stale details cannot change company state or append history', async () => {
  const { admin } = await newCompany('validation');
  const before = snapshot(admin.user.workspaceId);
  const invalid = [
    { displayName: '' },
    { displayName: ' \u2003 ' },
    { displayName: 'ع'.repeat(121) },
    { displayName: null },
    { displayName: 1 },
    { emirate: null },
    { emirate: '' },
    { emirate: 'Dubai' },
    { emirate: 'london' },
    { version: 0 },
    { version: -1 },
    { version: 1.5 },
    { version: '1' },
    { version: null },
    { accountType: 'individual' },
    { memberLimit: 1 },
    { origin: 'signup' },
    { workspaceId: admin.user.workspaceId },
    { actorId: admin.user.id },
    { extra: true },
  ];
  for (const change of invalid) {
    const response = await putCompany(admin, companyBody(change));
    assert.equal(response.status, 400, JSON.stringify(change));
    assert.equal(response.value.code, 'invalid_company');
  }
  for (const key of ['version', 'displayName', 'emirate']) {
    const body = companyBody();
    delete body[key];
    assert.equal((await putCompany(admin, body)).status, 400, `missing ${key}`);
  }
  assert.equal(snapshot(admin.user.workspaceId), before);
  const saved = await putCompany(admin, companyBody({ displayName: 'ع'.repeat(120) }));
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
  assert.equal(saved.value.displayName.length, 120);
  const committed = snapshot(admin.user.workspaceId);
  const stale = await putCompany(admin, companyBody({ displayName: 'Must not save' }));
  assert.equal(stale.status, 409);
  assert.equal(stale.value.code, 'stale');
  assert.equal(snapshot(admin.user.workspaceId), committed);
  const repeated = await putCompany(
    admin,
    companyBody({ version: 2, displayName: 'ع'.repeat(120) }),
  );
  assert.equal(repeated.status, 200);
  assert.equal(repeated.value.version, 3);
  assert.equal(events(admin.user.workspaceId).length, 3);
  assert.equal(
    JSON.parse(snapshot(admin.user.workspaceId)).profile.setup_completed_at,
    JSON.parse(committed).profile.setup_completed_at,
  );
});
