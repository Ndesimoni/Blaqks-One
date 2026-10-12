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
