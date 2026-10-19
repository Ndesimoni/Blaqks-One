import assert from 'node:assert/strict';
import { login, query } from './helpers.mjs';
import { activate, invite } from './team-helpers.mjs';

export const emptyCompany = {
  accountType: 'brokerage',
  memberLimit: null,
  displayName: null,
  emirate: null,
  setupComplete: false,
  version: 1,
};

export const companyPath = (session, workspace = session.user.workspaceId) =>
  `/workspaces/${workspace}/company`;

export const companyBody = (changes = {}) => ({
  version: 1,
  displayName: 'Synthetic Company',
  emirate: 'dubai',
  ...changes,
});

export const putCompany = (session, body, options = {}) =>
  session.request(companyPath(session), { method: 'PUT', body, ...options });

export async function readCompany(session) {
  const result = await session.request(companyPath(session));
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.match(result.headers.get('cache-control'), /no-store/);
  assert.deepEqual(Object.keys(result.value).sort(), Object.keys(emptyCompany).sort());
  return result.value;
}

/** Each test owns its company; stable CLI fixtures stay untouched. */
export async function newCompany(suffix) {
  const owner = await login('owner');
  const invitation = await invite(owner, `company-${suffix}`, {
    accountRole: 'admin',
    positions: [],
  });
  assert.equal(
    query(`SELECT count(*) FROM crm_company_profiles
      WHERE workspace_id='${invitation.member.id}' AND origin='operator'`),
    '1',
    'a pending Admin already has its company in the invitation transaction',
  );
  const admin = await activate(invitation);
  return { owner, invitation, admin: { ...admin, email: invitation.email } };
}

export const events = (workspace) =>
  JSON.parse(
    query(`SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY created_at,id),'[]')
      FROM crm_company_events e WHERE workspace_id='${workspace}'`),
  );

/** Exact profile and event snapshot detects partial or rejected writes. */
export const snapshot = (workspace) =>
  query(`SELECT jsonb_build_object('profile',to_jsonb(p),'events',
    (SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY created_at,id),'[]')
     FROM crm_company_events e WHERE e.workspace_id=p.workspace_id))
    FROM crm_company_profiles p WHERE workspace_id='${workspace}'`);

export function databaseFailure(sql) {
  try {
    query(sql);
  } catch (error) {
    return String(error.stderr);
  }
  assert.fail('Expected the database to reject the mutation.');
}

export function assertCompanyPayload(payload, expected) {
  assert.deepEqual(payload.company, expected);
  assert.equal('company' in payload.user, false, 'company is a sibling of the own user');
  assert.doesNotMatch(JSON.stringify(payload.company), /password|csrf|actor|origin|workspace/i);
}
