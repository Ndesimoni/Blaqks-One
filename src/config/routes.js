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
  { name: 'Marketplace applications', path: '/marketplace-applications' },
];
/** Connected-only sections outside the shared navigation (the frozen demo never links here). */
export const connectedRoutes = [
  { name: 'Inbox', path: '/inbox' },
  { name: 'Team chat', path: '/team-chat' },
  { name: 'Inbox rules', path: '/inbox-rules' },
  { name: 'My mailbox', path: '/my-mailbox' },
  { name: 'Agreements', path: '/agreements' },
  { name: 'Marketplace', path: '/marketplace' },
  // Google's sign-in returns here (E1a); the page finishes it and clears the address bar.
  { name: 'Google sign-in', path: '/oauth/google' },
];
export const routes = [...crmRoutes, ...settingsRoutes, ...connectedRoutes];

export const routePath = (name) => routes.find((route) => route.name === name)?.path || '/';
export const routeName = (path) =>
  routes.find(
    (route) => route.path === path.replace(/\/$/, '') || (route.path === '/' && path === '/'),
  )?.name || 'Page not found';
