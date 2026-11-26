import assert from 'node:assert/strict';
import { query } from './helpers.mjs';

export const seatLimitPath = (workspace) => `/workspaces/${workspace}/company/seat-limit`;

export const inviteBody = (suffix) => ({
  name: `Synthetic ${suffix}`,
  email: `${suffix}@team-limit.test`,
  phone: '+971501234567',
  positions: ['receptionist'],
});

export const rawInvite = (session, suffix, { workspace, ...options } = {}) =>
  session.request(`/workspaces/${workspace ?? session.user.workspaceId}/team/invitations`, {
    method: 'POST',
    body: inviteBody(suffix),
    ...options,
  });

export const changeLimit = (session, workspace, memberLimit, version, options = {}) =>
  session.request(seatLimitPath(workspace), {
    method: 'PUT',
    body: { memberLimit, version },
    ...options,
  });

export async function seatUsage(session) {
  const result = await session.request(`/workspaces/${session.user.workspaceId}/team`);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value.seats;
}

export async function changeLimitOk(superAdmin, companyAdmin, memberLimit) {
  const current = await seatUsage(companyAdmin);
  const result = await changeLimit(
    superAdmin,
    companyAdmin.user.workspaceId,
    memberLimit,
    current.version,
  );
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value;
}

export const stateSnapshot = (workspace) =>
  query(`SELECT jsonb_build_object('company',to_jsonb(p),'users',
    (SELECT COALESCE(jsonb_agg(to_jsonb(u) ORDER BY id),'[]') FROM crm_users u
      WHERE u.workspace_id='${workspace}'),'invitations',
    (SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY user_id),'[]')
      FROM crm_team_invitations i WHERE i.workspace_id='${workspace}'),'limitEvents',
    (SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY created_at,id),'[]')
      FROM crm_company_limit_events e WHERE e.workspace_id='${workspace}'))
    FROM crm_company_profiles p WHERE workspace_id='${workspace}'`);

export const limitEvents = (workspace) =>
  JSON.parse(
    query(`SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY created_at,id),'[]')
      FROM crm_company_limit_events e WHERE workspace_id='${workspace}'`),
  );
