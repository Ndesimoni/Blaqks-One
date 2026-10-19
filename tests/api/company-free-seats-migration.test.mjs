import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { seededDatabase } from './assignment-db.mjs';

const db = seededDatabase('kws_company_0025', '0025');
const owner = randomUUID();
const superAdmin = randomUUID();
const workspace = 'synthetic-seat-migration';

function addStaff(label, active, accepted, deleted = false) {
  const id = randomUUID();
  db.query(`INSERT INTO crm_users
    (id,name,email,phone,password_hash,role,active,owner_id,workspace_id,accepted_at,deleted_at)
    VALUES ('${id}','Synthetic ${label}','${label}@seat-migration.test','+971501234567',
    '${accepted ? 'fixture-hash' : ''}','staff',${active},'${owner}','${workspace}',
    ${accepted ? 'now()' : 'NULL'},${deleted ? 'now()' : 'NULL'})`);
  return id;
}

before(() => {
  db.create();
  for (const [id, role, label] of [
    [superAdmin, 'super-admin', 'super'],
    [owner, 'admin', 'owner'],
  ]) {
    db.query(`INSERT INTO crm_users(id,name,email,phone,password_hash,role,active)
      VALUES ('${id}','Synthetic ${label}','${label}@seat-migration.test',
      '+971501234567','fixture-hash','${role}',true)`);
  }
  db.query(`INSERT INTO crm_workspaces(id,owner_id) VALUES
    ('super-admin-workspace','${superAdmin}'),('${workspace}','${owner}');
    INSERT INTO crm_company_profiles(workspace_id,account_type,member_limit,origin) VALUES
    ('super-admin-workspace','brokerage',NULL,'existing'),
    ('${workspace}','individual',1,'existing')`);
  for (const label of ['active-one', 'active-two', 'active-three', 'active-four'])
    addStaff(label, true, true);
  const pending = addStaff('pending', false, false);
  const expired = addStaff('expired', false, false);
  addStaff('suspended', false, true);
  addStaff('archived', true, true, true);
  db.query(`INSERT INTO crm_team_invitations
    (token_hash,user_id,owner_id,workspace_id,created_by,expires_at) VALUES
    ('live-${pending}','${pending}','${owner}','${workspace}','${owner}',now()+interval '1 hour'),
    ('expired-${expired}','${expired}','${owner}','${workspace}','${owner}',now()-interval '1 hour')`);
  db.migrate('0025_free_company_seats.sql');
});

after(db.drop);

test('0025 preserves every occupied customer seat and leaves the system workspace unlimited', () => {
  assert.equal(
    db.query(`SELECT account_type||'|'||member_limit FROM crm_company_profiles
      WHERE workspace_id='${workspace}'`),
    'brokerage|6',
  );
  assert.equal(
    db.query(`SELECT account_type||'|'||COALESCE(member_limit::text,'unlimited')
      FROM crm_company_profiles WHERE workspace_id='super-admin-workspace'`),
    'brokerage|unlimited',
  );
  assert.match(
    db.failure(`UPDATE crm_company_profiles SET account_type='individual'
      WHERE workspace_id='${workspace}'`),
    /crm_company_account_type/i,
  );
});
