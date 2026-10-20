import { nav } from './navigation.js';

export const crmRoutes = nav.flatMap((group) =>
  group.items.map(([name]) => ({
    name,
    path: name === 'Dashboard' ? '/' : '/' + name.toLowerCase().replace(/\s+/g, '-'),
  })),
);
export const settingsRoutes = [
  { name: 'Team & access', path: '/team-access' },
  { name: 'My profile', path: '/my-profile' },
  { name: 'Channels', path: '/channels' },
  { name: 'Workspaces', path: '/workspaces' },
  { name: 'Team activity', path: '/team-activity' },
];
export const routes = [...crmRoutes, ...settingsRoutes];

export const routePath = (name) => routes.find((route) => route.name === name)?.path || '/';
export const routeName = (path) =>
  routes.find(
    (route) => route.path === path.replace(/\/$/, '') || (route.path === '/' && path === '/'),
  )?.name || 'Page not found';
