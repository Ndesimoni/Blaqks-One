import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { run, stop, waitForApi } from './crm-test-processes.mjs';

const project = `kws-crm-test-${randomBytes(6).toString('hex')}`;
const dbPassword = randomBytes(32).toString('hex');
const env = {
  ...process.env,
  CRM_TEST_DB_PASSWORD: dbPassword,
  CRM_TEST_PROJECT: project,
  CRM_APP_ORIGIN: 'http://localhost:5175',
  CRM_BIND_ADDRESS: '127.0.0.1:8790',
  CRM_ALLOW_INSECURE_LOCAL: 'true',
  CRM_TEST_API: 'http://127.0.0.1:8790/api/crm',
  CRM_FIXTURE_PASSWORD: randomBytes(24).toString('hex'),
  VITE_CRM_MODE: 'server',
  CRM_API_PROXY: 'http://127.0.0.1:8790',
};
const compose = ['compose', '-f', 'compose.test.yaml', '-p', project];
const binary = resolve('services/crm-api/target/debug/kws-crm-api');
let server;
let containerStarted = false;
try {
  await run(
    'cargo',
    ['build', '--locked', '--offline', '--manifest-path', 'services/crm-api/Cargo.toml'],
    env,
  );
  containerStarted = true;
  await run('docker', [...compose, 'up', '-d', '--wait'], env);
  const address = await run('docker', [...compose, 'port', 'postgres', '5432'], env, {
    capture: true,
  });
  const port = address.split(':').at(-1);
  if (!/^\d+$/.test(port)) throw Error('Docker did not report a PostgreSQL port.');
  env.CRM_DATABASE_URL = `postgres://kws_crm_test:${dbPassword}@127.0.0.1:${port}/kws_crm_test`;
  for (const [name, email, role] of [
    ['Fixture Owner', 'owner@crm-fixture.test', 'super-admin'],
    ['Fixture Admin A', 'admin-a@crm-fixture.test', 'admin'],
    ['Fixture Admin B', 'admin-b@crm-fixture.test', 'admin'],
  ]) {
    await run(binary, ['create-user'], {
      ...env,
      CRM_BOOTSTRAP_NAME: name,
      CRM_BOOTSTRAP_EMAIL: email,
      CRM_BOOTSTRAP_PHONE: '+971501234567',
      CRM_BOOTSTRAP_ROLE: role,
      CRM_BOOTSTRAP_PASSWORD: env.CRM_FIXTURE_PASSWORD,
    });
  }
  server = spawn(binary, [], { env, stdio: 'inherit' });
  await waitForApi(`${env.CRM_TEST_API}/health`, server);
  if (!process.argv.includes('--browser-only')) {
    await run(
      'node',
      [
        '--test',
        '--test-concurrency=1',
        'tests/api/auth.test.mjs',
        'tests/api/records.test.mjs',
        'tests/api/workflow-records.test.mjs',
        'tests/api/referral-links.test.mjs',
        'tests/api/referral-legacy.test.mjs',
        'tests/api/link-messages.test.mjs',
        'tests/api/scope.test.mjs',
        'tests/api/validation.test.mjs',
        'tests/api/import-access.test.mjs',
        'tests/api/import-validation.test.mjs',
        'tests/api/import-commit.test.mjs',
        'tests/api/import-transaction.test.mjs',
        'tests/api/demo-backup.test.mjs',
        'tests/api/team-access.test.mjs',
        'tests/api/team-invitations.test.mjs',
        'tests/api/team-invitation-lifecycle.test.mjs',
        'tests/api/team-permissions.test.mjs',
        'tests/api/team-renewal.test.mjs',
        'tests/api/team-archive-access.test.mjs',
        'tests/api/team-archive-workspace.test.mjs',
        'tests/api/team-archive-concurrency.test.mjs',
        'tests/api/team-archive-imports.test.mjs',
        'tests/api/team-archive-races.test.mjs',
        'tests/api/team-archive-transaction.test.mjs',
        'tests/api/assignment-scope.test.mjs',
        'tests/api/assignment-migration.test.mjs',
        'tests/api/assignment-triggers.test.mjs',
      ],
      env,
    );
    const identity = await fetch(`${env.CRM_TEST_API}/auth/login`, {
      method: 'POST',
      headers: { Origin: env.CRM_APP_ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@crm-fixture.test',
        password: env.CRM_FIXTURE_PASSWORD,
      }),
    });
    if (identity.status !== 200) throw Error('Could not prepare the API restart check.');
    const cookie = identity.headers.get('set-cookie').split(';')[0];
    await stop(server);
    server = spawn(binary, [], { env, stdio: 'inherit' });
    await waitForApi(`${env.CRM_TEST_API}/health`, server);
    await run('node', ['--test', 'tests/api/restart.test.mjs'], {
      ...env,
      CRM_RESTART_COOKIE: cookie,
    });
  }
  if (process.argv.includes('--browser') || process.argv.includes('--browser-only')) {
    await run(
      'docker',
      [
        ...compose,
        'exec',
        '-T',
        'postgres',
        'psql',
        '-U',
        'kws_crm_test',
        '-d',
        'kws_crm_test',
        '-c',
        'TRUNCATE crm_login_limits',
      ],
      env,
    );
    const filters = process.argv
      .slice(2)
      .filter((argument) => !['--browser', '--browser-only'].includes(argument));
    await run(
      'npx',
      ['playwright', 'test', '--config', 'playwright.server.config.js', ...filters],
      env,
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await stop(server);
  if (containerStarted) {
    try {
      await run('docker', [...compose, 'down'], env);
    } catch {
      console.error(`Could not remove isolated test container ${project}.`);
      process.exitCode = 1;
    }
  }
}
