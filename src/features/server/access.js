import { routePermissions } from '../../config/team.js';

export function canManageTeam(user) {
  return user?.roleId === 'admin' || user?.roleId === 'super-admin';
}

export function canOpenSection(user, route) {
  if (!['admin', 'super-admin', 'staff'].includes(user?.roleId)) return false;
  if (['Team & access', 'Team activity', 'Workspaces'].includes(route)) return canManageTeam(user);
  if (['Dashboard', 'Guide', 'My profile'].includes(route)) return true;
  if (route === 'Messages')
    return (
      canManageTeam(user) ||
      user.channelAccess?.email === true ||
      user.channelAccess?.whatsapp === true
    );
  const permission = routePermissions[route];
  return Boolean(permission && user.permissions?.[permission] === true);
}

const parentCollections = ['Clients', 'Properties', 'Contacts'];

/** Contract §5 H2: assigned-only staff cannot delete Clients, Properties or Contacts. */
export function canDeleteRecord(scope, module) {
  return scope === 'team' || !parentCollections.includes(module);
}

/** Contract §8 IDs: blank on create (issued by the server); assigned-only staff cannot type one. */
export function serverIdPolicy(scope, original) {
  return { issued: !original, readOnly: scope !== 'team' };
}
