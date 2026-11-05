import { SUPER_WORKSPACE_ID } from '../../config/workspaces.js';
import { STORAGE, PREFERENCE } from '../../config/storage.js';
import { routePath } from '../../config/routes.js';

export const workspaceStorageKey = (id) =>
  id === SUPER_WORKSPACE_ID ? STORAGE : `${STORAGE}:workspace:${encodeURIComponent(id)}`;
export const workspacePreferenceKey = (id) =>
  id === SUPER_WORKSPACE_ID ? PREFERENCE : `${PREFERENCE}:workspace:${encodeURIComponent(id)}`;

export function workspaceDirectory(team) {
  return [
    {
      id: SUPER_WORKSPACE_ID,
      name: 'Super Admin',
      role: 'Organisation workspace',
      status: 'active',
    },
    ...team.members.map((member) => ({
      id: member.id,
      name: member.name,
      role: team.roles.find((role) => role.id === member.roleId)?.name || 'Member',
      status: member.status,
    })),
  ];
}

/** Resolve access before any workspace repository is opened. Roles never change ownership. */
export function resolveWorkspace(team, user, requestedId) {
  if (!user) throw Error('Sign in before opening a workspace.');
  const id = requestedId || (user.managesTeam ? SUPER_WORKSPACE_ID : user.id);
  if (!user.managesTeam && id !== user.id)
    throw Error('You can only open your own workspace. Other members’ records are private.');
  const owner = workspaceDirectory(team).find((entry) => entry.id === id);
  if (!owner) throw Error('This workspace could not be found.');
  return owner;
}

export function workspaceUrl(route, id, query = '') {
  const params = new URLSearchParams({ workspace: id });
  if (query) params.set('q', query);
  return `${routePath(route)}?${params}`;
}
