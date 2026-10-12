import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

export const api = process.env.CRM_TEST_API;
export const origin = process.env.CRM_APP_ORIGIN;
if (!api || !origin || !process.env.CRM_FIXTURE_PASSWORD) {
  throw Error('Run API tests through npm run test:api with an isolated Docker database.');
}

export async function request(path, { method = 'GET', body, cookie, csrf, headers = {} } = {}) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let value;
  try {
    value = await response.json();
  } catch {
    value = null;
  }
  return { status: response.status, headers: response.headers, value };
}

export async function login(kind = 'admin-a') {
  const response = await request('/auth/login', {
    method: 'POST',
    body: { email: `${kind}@crm-fixture.test`, password: process.env.CRM_FIXTURE_PASSWORD },
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const { user, csrfToken: csrf } = response.value;
  assert.ok(user?.id && csrf);
  return {
    cookie,
    csrf,
    user,
    request: (path, options) => request(path, { cookie, csrf, ...options }),
  };
}

export const recordsPath = (session, collection, recordId) =>
  `/workspaces/${session.user.id}/records${collection ? `/${collection}` : ''}${recordId ? `/${recordId}` : ''}`;

export async function create(session, collection, record) {
  const response = await session.request(recordsPath(session, collection), {
    method: 'POST',
    body: { record },
  });
  assert.equal(response.status, 201);
  assert.ok(response.value.id);
  assert.equal(response.value.version, 1);
  return response.value;
}

export function query(sql) {
  const project = process.env.CRM_TEST_PROJECT;
  if (!project?.startsWith('kws-crm-test-')) throw Error('Database checks require a test project.');
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
      '-U',
      'kws_crm_test',
      '-d',
      'kws_crm_test',
      '-tAc',
      sql,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
}
