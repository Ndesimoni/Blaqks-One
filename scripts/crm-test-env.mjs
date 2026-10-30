// The isolated test run's environment (see test-crm-api.mjs). Every secret is random per
// run; Google and SendGrid point at the loopback stand-ins in scripts/fake-*.mjs.
import { randomBytes } from 'node:crypto';

export const FAKE_GOOGLE_PORT = 8791;
export const FAKE_SENDGRID_PORT = 8792;
export const TEST_ORIGIN = 'http://localhost:5175';

export function testEnv() {
  const project = `kws-crm-test-${randomBytes(6).toString('hex')}`;
  const dbPassword = randomBytes(32).toString('hex');
  const env = {
    ...process.env,
    CRM_TEST_DB_PASSWORD: dbPassword,
    CRM_TEST_PROJECT: project,
    CRM_APP_ORIGIN: TEST_ORIGIN,
    CRM_BIND_ADDRESS: '127.0.0.1:8790',
    CRM_ALLOW_INSECURE_LOCAL: 'true',
    CRM_SIGNUP: 'local',
    // Existing API suites inspect pending outbox codes, so keep the delivery worker stopped.
    CRM_SIGNUP_WORKER: 'off',
    // The suites send one synthetic sign-up per case; trust the loopback proxy and
    // give each case its own client budget through this header.
    CRM_TRUSTED_PROXIES: '127.0.0.1',
    CRM_TRUSTED_CLIENT_HEADER: 'x-test-client',
    CRM_CLIENT_DIGEST_SECRET: randomBytes(32).toString('hex'),
    // Seals synthetic channel credentials; suites assert they never leave the database.
    CRM_MESSAGING_KEY: randomBytes(32).toString('base64'),
    CRM_MESSAGING_KEY_VERSION: '1',
    CRM_TEST_API: 'http://127.0.0.1:8790/api/crm',
    // Random, and meets the new-password policy that the account CLI enforces.
    CRM_FIXTURE_PASSWORD: `Fx1!${randomBytes(24).toString('hex')}`,
    VITE_CRM_MODE: 'server',
    // Offers Arabic in My profile for apps/crm/tests/server-browser/language.spec.js; English stays default.
    VITE_I18N_PREVIEW: 'true',
    CRM_API_PROXY: 'http://127.0.0.1:8790',
  };
  Object.assign(env, {
    // File storage keys for the disposable storage container; its endpoint is set once
    // Docker reports the port.
    CRM_MEDIA_ACCESS_KEY: `crm${randomBytes(6).toString('hex')}`,
    CRM_MEDIA_SECRET_KEY: randomBytes(24).toString('hex'),
    CRM_MEDIA_BUCKET: 'crm-media-test',
    CRM_GOOGLE_CLIENT_ID: 'crm-test-client.apps.example',
    CRM_GOOGLE_CLIENT_SECRET: randomBytes(24).toString('hex'),
    CRM_GOOGLE_WORKSPACE_DOMAIN: 'keys-fixture.test',
    CRM_GOOGLE_ENDPOINT: `http://127.0.0.1:${FAKE_GOOGLE_PORT}`,
    CRM_TEST_GOOGLE: `http://127.0.0.1:${FAKE_GOOGLE_PORT}`,
    CRM_SENDGRID_ENDPOINT: `http://127.0.0.1:${FAKE_SENDGRID_PORT}`,
    CRM_TEST_SENDGRID: `http://127.0.0.1:${FAKE_SENDGRID_PORT}`,
    // Where the SendGrid stand-in posts signed delivery events: the test API itself.
    CRM_PUBLIC_URL: 'http://127.0.0.1:8790',
  });
  return { project, env };
}
