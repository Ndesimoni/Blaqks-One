import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { login, query, request } from './helpers.mjs';
import { activate, invite, staffLogin } from './team-helpers.mjs';

const binary = resolve('services/crm-api/target/debug/kws-crm-api');

export const sampleCounts = {
  Contacts: 8,
  Clients: 10,
  Properties: 12,
  'Follow-ups': 6,
  Viewings: 4,
  Shortlist: 5,
  'Interaction log': 4,
  'Client care': 3,
};
export const idKeys = {
  Contacts: 'contact_id',
  Clients: 'client_id',
  Properties: 'property_id',
  'Follow-ups': 'activity_id',
  Viewings: 'viewing_id',
  Shortlist: 'match_id',
  'Interaction log': 'log_id',
  'Client care': 'care_id',
};

/** Runs the CLI against the disposable test database; stdin is empty (EOF). */
export function runSample(command, { email, args = [], env = {}, yes = true } = {}) {
  assert.ok(process.env.CRM_TEST_PROJECT?.startsWith('kws-crm-test-'));
  const result = spawnSync(binary, [command, ...args, ...(yes ? ['--yes'] : [])], {
    env: { ...process.env, CRM_SAMPLE_ADMIN_EMAIL: email, ...env },
    input: '',
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

export function seed(email, args) {
  const result = runSample('seed-sample', { email, args });
  assert.equal(result.status, 0, result.stderr);
  return { ...result, staff: staffFrom(result.stdout) };
}

/** `{ email: { status, password } }` from the one-time terminal summary. */
export function staffFrom(stdout) {
  const staff = {};
  for (const [, email, status, password] of stdout.matchAll(
    /<([^>]+@example\.test)> (\w+); (?:password: (\S+))?/g,
  )) {
    staff[email] = { status, password };
  }
  return staff;
}

/** A fresh, active Admin team for one suite, so shared fixtures stay untouched. */
export async function sampleAdmin(prefix) {
  query('TRUNCATE crm_login_limits');
  const owner = await login('owner');
  const invited = await invite(owner, prefix, { accountRole: 'admin', positions: [] });
  const admin = await activate(invited);
  return { owner, admin, email: invited.email, workspace: admin.user.workspaceId };
}

export const staffEmail = (handle, adminEmail) =>
  `${handle}+${adminEmail
    .split('@')[0]
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()}@example.test`;

export async function signIn(email, password) {
  query('TRUNCATE crm_login_limits');
  return staffLogin(email, password);
}

export async function visible(session, workspace) {
  const result = await session.request(`/workspaces/${workspace}/records`);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  const ids = {};
  for (const [collection, key] of Object.entries(idKeys)) {
    ids[collection] = result.value.records[collection].map((entry) => entry.record[key]).sort();
  }
  return { ids, scope: result.value.scope, records: result.value.records };
}

export const sampleRows = (workspace) =>
  Number(
    query(
      `SELECT count(*) FROM crm_records r JOIN crm_sample_records m ON m.record_id=r.id
       WHERE r.workspace_id='${workspace}'`,
    ),
  );

export const loginStatus = async (email, password) =>
  (await request('/auth/login', { method: 'POST', body: { email, password } })).status;
