import assert from 'node:assert/strict';
import { request } from './helpers.mjs';

export const teamPath = (owner, id) =>
  `/workspaces/${owner.user.workspaceId || owner.user.id}/team${id ? `/${id}` : ''}`;

export async function invite(owner, suffix, overrides = {}) {
  const body = {
    name: `Synthetic ${suffix}`,
    email: `${suffix}@team-fixture.test`,
    phone: '+971501234567',
    positions: ['receptionist'],
    ...overrides,
  };
  const result = await owner.request(`${teamPath(owner)}/invitations`, {
    method: 'POST',
    body,
  });
  assert.equal(result.status, 201, JSON.stringify(result.value));
  assert.ok(result.value.member.id && result.value.invitation.token);
  return { ...result.value, email: body.email };
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
