import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { query } from './helpers.mjs';

/**
 * A second database inside the disposable test container. It is migrated to 0007,
 * seeded with pre-assignment rows, then given 0008, so the migration is exercised
 * on existing data without touching the API's database or any development volume.
 */
export const seedDatabase = 'kws_assign_0007';
const migrations = 'services/crm-api/migrations';
const project = process.env.CRM_TEST_PROJECT;

function psql(args, input, database = seedDatabase) {
  if (!project?.startsWith('kws-crm-test-')) throw Error('Seeded checks need a test project.');
  return execFileSync(
    'docker',
    [
      'compose',
      '-f',
      'compose.test.yaml',
      '-p',
      project,
      'exec',
      '-T',
      'postgres',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'kws_crm_test',
      '-d',
      database,
      ...args,
    ],
    { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
}

export const seedQuery = (sql) => psql(['-tAc', sql]);

/** Return the database error text for a statement that must fail. */
export function seedFailure(sql) {
  try {
    psql(['-tAc', sql]);
  } catch (error) {
    return String(error.stderr);
  }
  throw Error(`Expected failure: ${sql}`);
}

/** Apply one migration file in a single transaction, as sqlx does. */
export const migrate = (file) =>
  psql(['--single-transaction', '-q', '-f', '-'], readFileSync(`${migrations}/${file}`, 'utf8'));

export const migrationFiles = () =>
  readdirSync(migrations)
    .filter((file) => file.endsWith('.sql'))
    .sort();

export function createSeedDatabase() {
  query(`DROP DATABASE IF EXISTS ${seedDatabase} WITH (FORCE)`);
  query(`CREATE DATABASE ${seedDatabase}`);
  for (const file of migrationFiles().filter((name) => name < '0008')) migrate(file);
}

export const dropSeedDatabase = () => query(`DROP DATABASE IF EXISTS ${seedDatabase} WITH (FORCE)`);

export const viewColumns = (view) =>
  seedQuery(
    `SELECT string_agg(attname, ',' ORDER BY attnum) FROM pg_attribute
     WHERE attrelid='${view}'::regclass AND attnum>0 AND NOT attisdropped`,
  ).split(',');

/** The same helpers for another disposable database migrated up to `before` (exclusive). */
export function seededDatabase(name, before) {
  assert(/^kws_[a-z0-9_]+$/.test(name), 'Seeded database names are fixed test names.');
  const run = (sql) => psql(['-tAc', sql], undefined, name);
  const migrateFile = (file) =>
    psql(
      ['--single-transaction', '-q', '-f', '-'],
      readFileSync(`${migrations}/${file}`, 'utf8'),
      name,
    );
  return {
    query: run,
    failure(sql) {
      try {
        run(sql);
      } catch (error) {
        return String(error.stderr);
      }
      throw Error(`Expected failure: ${sql}`);
    },
    migrate: migrateFile,
    create() {
      query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      query(`CREATE DATABASE ${name}`);
      migrationFiles()
        .filter((file) => file < before)
        .forEach(migrateFile);
    },
    drop: () => query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`),
  };
}
