import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { query } from './helpers.mjs';

const binary = process.env.CRM_PRE_A2_BINARY;
const migrations = () =>
  query(`SELECT string_agg(version || ':' || success, ',' ORDER BY version) FROM _sqlx_migrations`);

/**
 * M-E rollback dry-run: a binary built before 0009 must refuse to start against the
 * migrated test database instead of running without action restrictions. Opt in with
 * CRM_PRE_A2_BINARY=<path to a pre-0009 kws-crm-api build>; it only runs `migrate`.
 */
test(
  'a pre-A2 binary refuses to start against a database that has 0009',
  { skip: binary ? false : 'set CRM_PRE_A2_BINARY to a pre-0009 build to run this check' },
  () => {
    const before = migrations();
    assert.match(before, /(^|,)9:true$/);
    const result = spawnSync(binary, ['migrate'], { env: process.env, encoding: 'utf8' });
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /CRM schema migration failed/);
    assert.equal(migrations(), before);
  },
);
