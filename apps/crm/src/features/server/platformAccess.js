/**
 * The Blaqks One team (BO1b, docs/blaqks-one-console.md §8): the Owner (internal role
 * `super-admin`) uses every area and manages the team; platform staff (role `platform`) use
 * each area at the level they were given, View or Manage (owner, 2026-11-05). Nobody on the
 * team opens a company's workspace. The server decides every request; this only decides
 * which pages and buttons to show.
 */
export const AREA_LEVELS = {
  dashboard: ['view'],
  companies: ['view', 'manage'],
  invite_admins: ['manage'],
  marketplace: ['view', 'manage'],
  platform_website: ['view', 'manage'],
  help_requests: ['view', 'manage'],
  clients: ['view', 'manage'],
};
export const PLATFORM_AREAS = Object.keys(AREA_LEVELS);

/** The pages each area opens (at View, except Team & access, which only inviting needs). */
const AREA_ROUTES = {
  dashboard: ['Platform dashboard'],
  companies: ['Workspaces'],
  marketplace: ['Marketplace applications'],
  platform_website: ['Platform website', 'Platform companies'],
};
const ALWAYS = ['Start', 'My profile', 'Sign-in and security'];
// The organisation's own team feed and the Blaqks One team are the Owner's alone.
const OWNER_ONLY = ['Team activity', 'Blaqks One team'];

export const isPlatformOwner = (user) => user?.roleId === 'super-admin';
export const isPlatformMember = (user) => isPlatformOwner(user) || user?.roleId === 'platform';

/** Whether `user` may use `area` at `level` ('view' or 'manage'; Manage includes View). */
export function hasPlatformArea(user, area, level = 'view') {
  if (isPlatformOwner(user)) return true;
  if (user?.roleId !== 'platform') return false;
  const given = user.platformAccess?.[area];
  return level === 'manage' ? given === 'manage' : given === 'view' || given === 'manage';
}

export function canOpenPlatformPage(user, route) {
  if (ALWAYS.includes(route)) return true;
  if (OWNER_ONLY.includes(route)) return isPlatformOwner(user);
  if (route === 'Team & access') return hasPlatformArea(user, 'invite_admins', 'manage');
  return Object.entries(AREA_ROUTES).some(
    ([area, routes]) => routes.includes(route) && hasPlatformArea(user, area),
  );
}
