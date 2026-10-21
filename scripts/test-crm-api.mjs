import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { checkExpiredSignupRemoved, seedExpiredSignup } from './check-signup-cleanup.mjs';
import { checkSignupOff } from './check-signup-off.mjs';
import { selectedApiTestFiles } from './crm-api-test-files.mjs';
import { FAKE_GOOGLE_PORT, testEnv } from './crm-test-env.mjs';
import { createFixtures, raiseFixtureSeats } from './crm-test-fixtures.mjs';
import { startFakeGoogle } from './fake-google.mjs';
import { ensurePortFree, run, startWorker, stop, waitForApi } from './crm-test-processes.mjs';
import { markDatabase } from './mark-dev-database.mjs';

// Optional API_TEST_FILES (comma-separated) narrows the API suites; see crm-api-test-files.mjs.
const apiTestFiles = selectedApiTestFiles();
const { project, env } = testEnv();
const compose = ['compose', '-f', 'compose.test.yaml', '-p', project];
const binary = resolve('services/crm-api/target/debug/kws-crm-api');
let server;
let google;
let worker;
let containerStarted = false;
try {
  await run(
    'cargo',
    ['build', '--locked', '--offline', '--manifest-path', 'services/crm-api/Cargo.toml'],
    env,
  );
  containerStarted = true;
  await run('docker', [...compose, 'up', '-d', '--wait'], env);
  markDatabase(compose, env);
  const address = await run('docker', [...compose, 'port', 'postgres', '5432'], env, {
    capture: true,
  });
  const port = address.split(':').at(-1);
  if (!/^\d+$/.test(port)) throw Error('Docker did not report a PostgreSQL port.');
  env.CRM_DATABASE_URL = `postgres://kws_crm_test:${env.CRM_TEST_DB_PASSWORD}@127.0.0.1:${port}/kws_crm_test`;
  const storage = await run('docker', [...compose, 'port', 'storage', '8333'], env, {
    capture: true,
  });
  env.CRM_MEDIA_ENDPOINT = `http://127.0.0.1:${storage.split(':').at(-1)}`;
  await createFixtures(binary, env);
  await ensurePortFree('127.0.0.1', 8790);
  await ensurePortFree('127.0.0.1', FAKE_GOOGLE_PORT);
  google = await startFakeGoogle({
    port: FAKE_GOOGLE_PORT,
    clientId: env.CRM_GOOGLE_CLIENT_ID,
    clientSecret: env.CRM_GOOGLE_CLIENT_SECRET,
    redirectUri: `${env.CRM_APP_ORIGIN}/api/crm/integrations/google/callback`,
  });
  await checkSignupOff(binary, env);
  seedExpiredSignup(compose);
  server = spawn(binary, [], { env, stdio: 'inherit' });
  await waitForApi(`${env.CRM_TEST_API}/health`, server);
  checkExpiredSignupRemoved(compose);
  await raiseFixtureSeats(compose, env);
  if (!process.argv.includes('--browser-only')) {
    // Database-backed Rust contracts use this same disposable, migrated database.
    await run(
      'cargo',
      [
        'test',
        '--locked',
        '--offline',
        '--manifest-path',
        'services/crm-api/Cargo.toml',
        '--lib',
        '--',
        '--ignored',
        '--test-threads=1',
      ],
      env,
    );
  }
  // After the Rust contracts, which create and inspect outbox jobs themselves.
  worker = startWorker(binary, env);
  if (!process.argv.includes('--browser-only')) {
    await run('node', ['--test', '--test-concurrency=1', ...apiTestFiles], env);
  }
  // The restart check reads records the full suite saves, so a filtered run skips it.
  const filtered = Boolean(process.env.API_TEST_FILES?.trim());
  if (filtered) console.log('API_TEST_FILES is set: skipping the restart check.');
  if (!process.argv.includes('--browser-only') && !filtered) {
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
  await stop(worker);
  await stop(server);
  await google?.close();
  if (containerStarted) {
    try {
      await run('docker', [...compose, 'down'], env);
    } catch {
      console.error(`Could not remove isolated test container ${project}.`);
      process.exitCode = 1;
    }
  }
}
