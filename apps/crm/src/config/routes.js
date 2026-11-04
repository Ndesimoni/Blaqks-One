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
  { name: 'Start', path: '/start' },
  { name: 'Website', path: '/website' },
  // The Websites product's other sections and Platform website's Companies tab (NAV).
  { name: 'Website team', path: '/website-team' },
  { name: 'Website properties', path: '/website-properties' },
  { name: 'Website enquiries', path: '/website-enquiries' },
  { name: 'Platform website', path: '/platform-website' },
  { name: 'Platform companies', path: '/platform-companies' },
  { name: 'Inbox', path: '/inbox' },
  { name: 'Team chat', path: '/team-chat' },
  { name: 'Inbox rules', path: '/inbox-rules' },
  { name: 'My mailbox', path: '/my-mailbox' },
  { name: 'My WhatsApp', path: '/my-whatsapp' },
  // The Admin's company details (design queue item 15).
  { name: 'Company', path: '/company' },
  // My profile's other header tabs (design queue item 14).
  { name: 'Website profile', path: '/website-profile' },
  { name: 'Sign-in and security', path: '/sign-in-security' },
  { name: 'Agreements', path: '/agreements' },
  { name: 'Marketplace', path: '/marketplace' },
  // The Marketplace's other sections (design queue items 26–30).
  { name: 'My requests', path: '/my-requests' },
  { name: 'Marketplace updates', path: '/marketplace-updates' },
  { name: 'Broker profile', path: '/broker-profile' },
  // Google's sign-in returns here (E1a); the page finishes it and clears the address bar.
  { name: 'Google sign-in', path: '/oauth/google' },
];
export const routes = [...crmRoutes, ...settingsRoutes, ...connectedRoutes];

export const routePath = (name) => routes.find((route) => route.name === name)?.path || '/';
export const routeName = (path) =>
  routes.find(
    (route) => route.path === path.replace(/\/$/, '') || (route.path === '/' && path === '/'),
  )?.name || 'Page not found';
