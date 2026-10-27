import assert from 'node:assert/strict';
import { login, query, request } from './helpers.mjs';

export const teamPath = (owner, id) =>
  `/workspaces/${owner.user.workspaceId || owner.user.id}/team${id ? `/${id}` : ''}`;

const inviteBody = (suffix, overrides) => ({
  name: `Synthetic ${suffix}`,
  email: `${suffix}@team-fixture.test`,
  phone: '+971501234567',
  positions: ['receptionist'],
  ...overrides,
});

const sendInvite = (owner, body) =>
  owner.request(`${teamPath(owner)}/invitations`, { method: 'POST', body });

function invited(result, body) {
  assert.equal(result.status, 201, JSON.stringify(result.value));
  assert.ok(result.value.member.id && result.value.invitation.token);
  return { ...result.value, email: body.email };
}

/** An invitation that never changes seats; seat-limit suites use this one. */
export async function inviteExact(owner, suffix, overrides = {}) {
  const body = inviteBody(suffix, overrides);
  return invited(await sendInvite(owner, body), body);
}

let superAdmin;

/** Ten more seats for a full company, through the real Super Admin route. */
export async function addSeats(workspace) {
  const [limit, version] = query(
    `SELECT member_limit||'|'||version FROM crm_company_profiles WHERE workspace_id='${workspace}'`,
  ).split('|');
  const change = () =>
    superAdmin.request(`/workspaces/${workspace}/company/seat-limit`, {
      method: 'PUT',
      body: { memberLimit: Number(limit) + 10, version: Number(version) },
    });
  superAdmin ??= await login('owner');
  let result = await change();
  if (result.status === 401) {
    superAdmin = await login('owner');
    result = await change();
  }
  assert.equal(result.status, 200, JSON.stringify(result.value));
}

/**
 * Most suites need more staff than the three-seat Free plan allows. When the company is
 * full, the Super Admin adds seats and the invitation is retried once.
 */
export async function invite(owner, suffix, overrides = {}) {
  const body = inviteBody(suffix, overrides);
  let result = await sendInvite(owner, body);
  if (result.status === 409 && result.value?.code === 'team_limit_reached') {
    await addSeats(owner.user.workspaceId || owner.user.id);
    result = await sendInvite(owner, body);
  }
  return invited(result, body);
}

export async function staffLogin(email, password = 'Team123!') {
  const result = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(result.status, 200, JSON.stringify(result.value));
  const cookie = result.headers.get('set-cookie').split(';')[0];
  const { user, csrfToken: csrf } = result.value;
  return {
    user,
    cookie,
    csrf,
    request: (path, options) => request(path, { cookie, csrf, ...options }),
  };
}

export async function activate(invited, password = 'Team123!') {
  const accepted = await request('/auth/invitations/accept', {
    method: 'POST',
    body: { token: invited.invitation.token, password },
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.value));
  return staffLogin(invited.email, password);
}

export async function findMember(owner, id) {
  const result = await owner.request(teamPath(owner));
  assert.equal(result.status, 200);
  const member = result.value.members.find((item) => item.id === id);
  assert.ok(member);
  return member;
}

export function memberUpdate(member, changes = {}) {
  return {
    version: member.version,
    name: member.name,
    phone: member.phone,
    positions: member.positions,
    permissions: member.permissions,
    channelAccess: member.channelAccess,
    active: member.active,
    ...changes,
  };
}
