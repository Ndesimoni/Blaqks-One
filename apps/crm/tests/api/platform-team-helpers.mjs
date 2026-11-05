// Blaqks One team (BO1b, docs/blaqks-one-console.md §8): invitations by the Owner with a
// position and `{area: level}` access, and the Owner-only team routes.
import assert from 'node:assert/strict';
import { activate } from './team-helpers.mjs';

export const TEAM = '/platform/team';
export const ORGANISATION = 'super-admin-workspace';

/** Each area's allowed levels, lowest first (owner 2026-11-05). */
export const AREA_LEVELS = {
  dashboard: ['view'],
  companies: ['view', 'manage'],
  invite_admins: ['manage'],
  marketplace: ['view', 'manage'],
  platform_website: ['view', 'manage'],
  help_requests: ['view', 'manage'],
  clients: ['view', 'manage'],
};

/** Every area at its highest level: the Owner's access and the Manager position. */
export const EVERYTHING = Object.fromEntries(
  Object.entries(AREA_LEVELS).map(([area, levels]) => [area, levels.at(-1)]),
);

export const PRESETS = {
  manager: EVERYTHING,
  sales: { clients: 'manage', companies: 'view' },
  support: { companies: 'view', help_requests: 'manage' },
  analyst: { dashboard: 'view' },
};

export const teamBody = (suffix, preset = 'support', access = PRESETS[preset]) => ({
  name: `Synthetic ${suffix}`,
  email: `${suffix}@platform-team.test`,
  phone: '+971501234567',
  preset,
  access,
});

/** The Owner invites one person; the result carries the member row and the link token. */
export async function inviteTeam(owner, suffix, preset, access) {
  const body = teamBody(suffix, preset, access);
  const result = await owner.request(TEAM, { method: 'POST', body });
  assert.equal(result.status, 201, JSON.stringify(result.value));
  return { ...result.value, email: body.email };
}

/** An activated, signed-in platform member with the position's (or the given) access. */
export async function teamMember(owner, suffix, preset, access) {
  return activate(await inviteTeam(owner, suffix, preset, access));
}

/** The Owner's current row for a member. */
export async function teamRow(owner, id) {
  const listed = await owner.request(TEAM);
  assert.equal(listed.status, 200, JSON.stringify(listed.value));
  return listed.value.members.find((member) => member.id === id);
}

/** The Owner-only team routes, as `[method, path, body]`, aimed at `id`. */
export const teamRoutes = (id, version = 1) => [
  ['GET', TEAM],
  ['POST', TEAM, teamBody(`forged-${id.slice(0, 8)}`)],
  ['PATCH', `${TEAM}/${id}`, { version, preset: 'analyst', access: PRESETS.analyst }],
  ['PUT', `${TEAM}/${id}/active`, { version, active: false }],
  ['POST', `${TEAM}/${id}/invitation`, { version }],
  ['POST', `${TEAM}/${id}/sign-out`],
  ['POST', `${TEAM}/${id}/password-reset`, { version }],
  ['DELETE', `${TEAM}/${id}`, { version, confirmationEmail: 'x@platform-team.test' }],
];

/** Every Owner-only team route answers 403 to this session. */
export async function expectNoTeam(session, id) {
  for (const [method, path, body] of teamRoutes(id)) {
    const { status } = await session.request(path, { method, body });
    assert.equal(status, 403, `${method} ${path}`);
  }
}
