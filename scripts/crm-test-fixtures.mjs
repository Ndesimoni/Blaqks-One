/** Fixture accounts for the API and connected browser suites (see test-crm-api.mjs). */
import { run } from './crm-test-processes.mjs';

/** Seats for the two shared fixture companies; seat-limit suites use their own companies. */
export const FIXTURE_SEATS = 1000;

const accounts = [
  ['Fixture Owner', 'owner@crm-fixture.test', 'super-admin'],
  ['Fixture Admin A', 'admin-a@crm-fixture.test', 'admin'],
  ['Fixture Admin B', 'admin-b@crm-fixture.test', 'admin'],
];

export async function createFixtures(binary, env) {
  for (const [name, email, role] of accounts) {
    await run(binary, ['create-user'], {
      ...env,
      CRM_BOOTSTRAP_NAME: name,
      CRM_BOOTSTRAP_EMAIL: email,
      CRM_BOOTSTRAP_PHONE: '+971501234567',
      CRM_BOOTSTRAP_ROLE: role,
      CRM_BOOTSTRAP_PASSWORD: env.CRM_FIXTURE_PASSWORD,
    });
  }
}

async function call(env, path, { method = 'GET', body, cookie, csrf } = {}) {
  const response = await fetch(`${env.CRM_TEST_API}${path}`, {
    method,
    headers: {
      Origin: env.CRM_APP_ORIGIN,
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw Error(`Fixture setup ${method} ${path} returned ${response.status}.`);
  return response;
}

/**
 * The suites invite many staff under the two fixture Admins, beyond the three-seat Free
 * plan. The Super Admin raises their limits once through the real seat-limit route, so
 * each change is recorded as a company limit event, then signs out.
 */
export async function raiseFixtureSeats(compose, env) {
  const ids = await run(
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
      '-tAc',
      "SELECT id FROM crm_users WHERE email IN ('admin-a@crm-fixture.test','admin-b@crm-fixture.test')",
    ],
    env,
    { capture: true },
  );
  const login = await call(env, '/auth/login', {
    method: 'POST',
    body: { email: 'owner@crm-fixture.test', password: env.CRM_FIXTURE_PASSWORD },
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const { csrfToken: csrf } = await login.json();
  for (const workspace of ids.split(/\s+/).filter(Boolean)) {
    await call(env, `/workspaces/${workspace}/company/seat-limit`, {
      method: 'PUT',
      body: { memberLimit: FIXTURE_SEATS, version: 1 },
      cookie,
      csrf,
    });
  }
  await call(env, '/auth/logout', { method: 'POST', cookie, csrf });
}
