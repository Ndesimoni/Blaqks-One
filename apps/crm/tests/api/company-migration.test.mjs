import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { seededDatabase } from './assignment-db.mjs';
import { login, query } from './helpers.mjs';
import { FIXTURE_SEATS } from '../../../../scripts/crm-test-fixtures.mjs';
import { emptyCompany, events, readCompany, systemCompany } from './company-helpers.mjs';

const db = seededDatabase('kws_company_0022', '0023');
const people = ['super', 'active', 'suspended', 'pending', 'archived'];
const ids = Object.fromEntries(people.map((name) => [name, randomUUID()]));
let identityBefore;
const identity = () => db.query(`SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM crm_users u`);

before(() => {
  db.create();
  for (const name of people) {
    const active = ['super', 'active'].includes(name);
    db.query(`INSERT INTO crm_users
      (id,name,email,phone,password_hash,role,active,deleted_at,accepted_at)
      VALUES ('${ids[name]}','Synthetic ${name}','${name}@company-seed.test',
      '+971501234567','${name === 'pending' ? '' : 'fixture-hash'}',
      '${name === 'super' ? 'super-admin' : 'admin'}',${active},
      ${name === 'archived' ? 'now()' : 'NULL'},${name === 'pending' ? 'NULL' : 'now()'})`);
    db.query(`INSERT INTO crm_workspaces(id,owner_id) VALUES ('${ids[name]}','${ids[name]}')`);
  }
  db.query(
    `INSERT INTO crm_workspaces(id,owner_id) VALUES ('super-admin-workspace','${ids.super}')`,
  );
  identityBefore = identity();
  db.migrate('0023_company_profiles.sql');
});
after(db.drop);

test('0023 backfills every workspace without changing identities or fabricating company history', () => {
  assert.equal(identity(), identityBefore);
  assert.equal(db.query('SELECT count(*) FROM crm_company_profiles'), '6');
  assert.equal(
    db.query(`SELECT count(*) FROM crm_workspaces w LEFT JOIN crm_company_profiles p
    ON p.workspace_id=w.id WHERE p.workspace_id IS NULL`),
    '0',
  );
  assert.equal(
    db.query(`SELECT count(*) FROM crm_company_profiles WHERE account_type='brokerage'
    AND member_limit IS NULL AND origin='existing' AND version=1 AND display_name IS NULL
    AND emirate IS NULL AND setup_completed_at IS NULL`),
    '6',
  );
  assert.equal(db.query('SELECT count(*) FROM crm_company_events'), '0');
  assert.equal(
    db.query(`SELECT count(*) FROM pg_constraint WHERE contype='f'
    AND conrelid IN ('crm_company_profiles'::regclass,'crm_company_events'::regclass)
    AND confrelid NOT IN ('crm_workspaces'::regclass,'crm_company_profiles'::regclass)`),
    '0',
  );
});

test('company schema enforces kinds, individual seat count, legal fields and redacted actions', () => {
  const workspace = ids.active;
  for (const change of [
    "account_type='unknown'",
    'member_limit=0',
    "account_type='individual',member_limit=NULL",
    "account_type='individual',member_limit=2",
    "origin='unknown'",
    "display_name=''",
    "display_name=repeat('ع',121)",
    "emirate='london'",
  ])
    assert.match(
      db.failure(`UPDATE crm_company_profiles SET ${change}
    WHERE workspace_id='${workspace}'`),
      /violates check constraint/i,
      change,
    );
  db.query(`UPDATE crm_company_profiles SET account_type='individual',member_limit=1,
    display_name=repeat('ع',120) WHERE workspace_id='${workspace}'`);
  assert.equal(
    db.query(`SELECT account_type||':'||member_limit FROM crm_company_profiles
    WHERE workspace_id='${workspace}'`),
    'individual:1',
  );
  assert.match(
    db.failure(`INSERT INTO crm_company_events
    (id,workspace_id,actor_id,action) VALUES
    (gen_random_uuid(),'${workspace}','${ids.active}','named_customer')`),
    /check constraint/i,
  );
});

test('trusted CLI creates both Super Admin workspaces and Admin companies with truthful history', async () => {
  query('TRUNCATE crm_login_limits');
  const owner = await login('owner');
  const admin = await login('admin-a');
  assert.equal(
    query(`SELECT count(*) FROM crm_workspaces w LEFT JOIN crm_company_profiles p
    ON p.workspace_id=w.id WHERE p.workspace_id IS NULL`),
    '0',
  );
  assert.deepEqual(await readCompany(owner), systemCompany);
  // The test runner raised the shared fixture's seats once through the Super Admin route.
  const fixture = { ...emptyCompany, memberLimit: FIXTURE_SEATS, version: 2 };
  assert.deepEqual(await readCompany(admin), fixture);
  for (const [workspace, actor] of [
    [owner.user.workspaceId, owner.user.id],
    [owner.user.id, owner.user.id],
    [admin.user.workspaceId, admin.user.id],
  ]) {
    assert.equal(
      query(`SELECT origin FROM crm_company_profiles WHERE workspace_id='${workspace}'`),
      'operator',
    );
    const history = events(workspace);
    assert.equal(history.length, 1);
    assert.equal(history[0].action, 'created');
    assert.equal(history[0].actor_id, actor);
  }
});
