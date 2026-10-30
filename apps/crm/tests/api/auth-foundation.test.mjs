import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { login, query } from './helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('trusted bootstrap preserves the initial Super Admin and separate Admin workspaces', async () => {
  const owner = await login('owner');
  const admin = await login('admin-a');
  assert.equal(owner.user.roleId, 'super-admin');
  assert.equal(owner.user.workspaceId, 'super-admin-workspace');
  assert.equal(admin.user.roleId, 'admin');
  assert.equal(admin.user.workspaceId, admin.user.id);
  const owned = query(
    `SELECT string_agg(id,',' ORDER BY id) FROM crm_workspaces WHERE owner_id='${owner.user.id}'`,
  );
  assert.deepEqual(owned.split(','), [owner.user.id, 'super-admin-workspace'].sort());
  assert.equal(query(`SELECT count(*) FROM crm_users WHERE role='super-admin'`), '1');
  assert.equal(
    query(`SELECT id FROM crm_workspaces WHERE owner_id='${admin.user.id}'`),
    admin.user.id,
  );
  assert.equal(query(`SELECT count(*) FROM crm_users WHERE email_verified_at IS NOT NULL`), '0');
  assert.equal(query('SELECT count(*) FROM crm_account_consents'), '0');
});

test('existing limit inserts retain the original default window without storing the key', async () => {
  const session = await login('admin-b');
  assert.equal(session.user.roleId, 'admin');
  assert.equal(query('SELECT bool_and(window_seconds=900) FROM crm_login_limits'), 't');
  assert.equal(query("SELECT count(*) FROM crm_login_limits WHERE key_hash LIKE '%@%'"), '0');
  query("INSERT INTO crm_login_limits (key_hash,attempts) VALUES ('s1-synthetic-default',1)");
  try {
    assert.equal(
      query("SELECT window_seconds FROM crm_login_limits WHERE key_hash='s1-synthetic-default'"),
      '900',
    );
  } finally {
    query("DELETE FROM crm_login_limits WHERE key_hash='s1-synthetic-default'");
  }
});
