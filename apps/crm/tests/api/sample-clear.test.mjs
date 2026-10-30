import assert from 'node:assert/strict';
import { test } from 'node:test';
import { query } from './helpers.mjs';
import {
  loginStatus,
  noLocalStandIns,
  sampleAdmin,
  sampleRows,
  seed,
  runSample,
  signIn,
  staffEmail,
  visible,
} from './sample-helpers.mjs';

const count = (sql) => Number(query(`SELECT count(*) FROM ${sql}`));

test('clear-sample removes exactly the sample records and suspends sample staff', async () => {
  const { admin, email, workspace } = await sampleAdmin('sample-clear-admin');
  const seeded = seed(email);
  const path = (collection, id = '') =>
    `/workspaces/${workspace}/records/${collection}${id && `/${id}`}`;
  const add = async (collection, record) => {
    const result = await admin.request(path(collection), { method: 'POST', body: { record } });
    assert.equal(result.status, 201, JSON.stringify(result.value));
    return result.value;
  };
  // People's own records survive, even when typed to look like sample data.
  const lookalike = await add('Clients', { full_name: 'Sample · Omar Haddad', notes: 'Mine' });
  const typed = await add('Clients', { client_id: 'CL-S11', full_name: 'Sample · Typed ID' });
  const linked = await add('Follow-ups', { client_id: 'CL-S01', next_action: 'Mine' });
  // Editing a sample record keeps it sample data.
  const { records } = await visible(admin, workspace);
  const edited = records.Clients.find((entry) => entry.record.client_id === 'CL-S02');
  const patched = await admin.request(path('Clients', edited.id), {
    method: 'PATCH',
    body: { version: edited.version, record: { ...edited.record, notes: 'Edited by a person' } },
  });
  assert.equal(patched.status, 200, JSON.stringify(patched.value));

  const refused = runSample('clear-sample', { email });
  assert.equal(refused.status, 1);
  assert.match(
    refused.stderr,
    /1 record\(s\) that people added link to sample records: Follow-ups FU-001/,
  );
  assert.match(refused.stderr, /Nothing was changed\.$/m);
  assert.equal(sampleRows(workspace), 52);
  const removed = await admin.request(path('Follow-ups', linked.id), {
    method: 'DELETE',
    body: { version: linked.version },
  });
  assert.equal(removed.status, 200, JSON.stringify(removed.value));

  const changed = runSample('clear-sample', { email });
  assert.equal(changed.status, 1);
  assert.match(changed.stderr, /1 sample record\(s\) were changed in the app: Clients CL-S02\./);
  assert.match(changed.stderr, /--include-edited/);
  assert.equal(sampleRows(workspace), 52);
  const cleared = runSample('clear-sample', { email, args: ['--include-edited'] });
  assert.equal(cleared.status, 0, cleared.stderr);
  assert.match(cleared.stdout, /Total\s+52 removed/);
  assert.match(cleared.stdout, /Sample staff suspended: 3/);
  assert.equal(sampleRows(workspace), 0);
  assert.equal(count(`crm_sample_records WHERE workspace_id='${workspace}'`), 0);
  const left = query(`SELECT string_agg(id::text, ',' ORDER BY id) FROM crm_records
    WHERE workspace_id='${workspace}'`);
  assert.equal(left, [lookalike.id, typed.id].sort().join(','));
  assert.equal(
    count(`crm_activity WHERE workspace_id='${workspace}' AND action='deleted'
    AND actor_id='${admin.user.id}'`),
    53 + 6 + 5 + 3, // records, one person's follow-up, then deals, payments and expenses
  );
  const members = query(`SELECT string_agg(u.active::text, ',') FROM crm_users u
    JOIN crm_sample_accounts m ON m.user_id=u.id WHERE m.workspace_id='${workspace}'`);
  assert.equal(members, 'false,false,false');
  assert.equal(
    count(`crm_team_activity WHERE workspace_id='${workspace}' AND action='suspended'`),
    3,
  );
  const layla = staffEmail('sample.layla', email);
  assert.notEqual(await loginStatus(layla, seeded.staff[layla].password), 200);
  assert.match(runSample('clear-sample', { email }).stdout, /Total\s+0 removed/);

  // Seeding again restores the records and reactivates staff with new passwords.
  const again = seed(email);
  assert.match(again.stdout, /Total\s+52 added,\s+0 already present/);
  assert.equal(again.staff[layla].status, 'reactivated');
  assert.notEqual(again.staff[layla].password, seeded.staff[layla].password);
  const session = await signIn(layla, again.staff[layla].password);
  assert.deepEqual((await visible(session, workspace)).ids.Clients, ['CL-S02', 'CL-S04', 'CL-S09']);
});

test('sample commands refuse other targets and non-local configurations', async () => {
  const { owner } = await sampleAdmin('sample-guard-admin');
  const before = count('crm_sample_records');
  const pending = await owner.request(`/workspaces/${owner.user.workspaceId}/team/invitations`, {
    method: 'POST',
    body: {
      name: 'Pending Admin',
      email: 'sample-pending@team-fixture.test',
      phone: '+971500000999',
      accountRole: 'admin',
    },
  });
  assert.equal(pending.status, 201, JSON.stringify(pending.value));
  const cases = [
    ['owner@crm-fixture.test', /pass --organisation/],
    [staffEmail('sample.layla', 'sample-clear-admin@x.test'), /That is a staff account/],
    ['sample-pending@team-fixture.test', /suspended or has not been activated/],
    ['nobody@crm-fixture.test', /No CRM account uses that email/],
  ];
  for (const [email, message] of cases) {
    const result = runSample('seed-sample', { email, args: ['--no-staff'] });
    assert.equal(result.status, 1, email);
    assert.match(result.stderr, message);
  }
  assert.match(runSample('seed-sample', { args: ['--force'] }).stderr, /Unknown option --force/);
  const local = /local development database only/;
  const url = process.env.CRM_DATABASE_URL;
  for (const env of [
    { CRM_DATABASE_URL: 'postgres://kws:secret@db.example.invalid:5432/kws_crm' },
    { CRM_DATABASE_URL: `${url}?host=db.example.invalid` },
    {
      CRM_ALLOW_INSECURE_LOCAL: 'false',
      CRM_APP_ORIGIN: 'https://crm.example.com',
      CRM_SIGNUP: 'off',
      ...noLocalStandIns,
    },
  ]) {
    for (const command of ['seed-sample', 'clear-sample']) {
      const result = runSample(command, { email: 'admin-a@crm-fixture.test', env });
      assert.equal(result.status, 1);
      assert.match(result.stderr, local);
    }
  }
  assert.equal(count('crm_sample_records'), before);
  // The organisation workspace is used only on request, then cleared again.
  const organisation = runSample('seed-sample', {
    email: 'owner@crm-fixture.test',
    args: ['--organisation', '--no-staff'],
  });
  assert.equal(organisation.status, 0, organisation.stderr);
  assert.equal(sampleRows('super-admin-workspace'), 52);
  const clearOrg = { email: 'owner@crm-fixture.test', args: ['--organisation'] };
  assert.equal(runSample('clear-sample', clearOrg).status, 0);
  assert.equal(sampleRows('super-admin-workspace'), 0);
});
