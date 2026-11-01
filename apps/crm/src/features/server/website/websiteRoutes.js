/**
 * The website routes (NAV, owner 2026-10-31 and 2026-11-01). The former in-page tabs of
 * Website and Platform website are routes: sections of the Websites product, and header tabs
 * of Platform → Platform website. Each keeps exactly the gate its tab had: `company` routes
 * need the owning company Admin, `enquiries` also the Clients module (enquiries/views.rs), and
 * `platform` routes the Super Admin. The server stays authoritative; these gates only decide
 * what the navigation offers.
 *
 * `section` is the panel ServerWebsite shows; `title` names the page and `tab` a header tab
 * (English catalogue keys); `icon` is the navigation icon.
 */
export const WEBSITE_ROUTES = Object.freeze({
  Website: { section: 'content', gate: 'company', icon: 'home', title: 'websites.title' },
  'Website team': { section: 'team', gate: 'company', icon: 'users', title: 'websites.tabs.team' },
  'Website properties': {
    section: 'properties',
    gate: 'company',
    icon: 'building',
    title: 'websites.tabs.properties',
  },
  'Website enquiries': {
    section: 'enquiries',
    gate: 'enquiries',
    icon: 'chat',
    title: 'websites.tabs.enquiries',
  },
  'Platform website': {
    section: 'general',
    gate: 'platform',
    icon: 'building',
    title: 'websites.platformTitle',
    tab: 'websites.tabs.general',
  },
  'Platform companies': {
    section: 'companies',
    gate: 'platform',
    icon: 'briefcase',
    title: 'websites.tabs.companies',
    tab: 'websites.tabs.companies',
  },
});

/** The route's entry, or null when `name` is not a website route. */
export const websiteRoute = (name) =>
  typeof name === 'string' && Object.hasOwn(WEBSITE_ROUTES, name) ? WEBSITE_ROUTES[name] : null;

/**
 * Whether `user` may open website route `name`, or null when it is not one. `canOpenClients`
 * is access.js's own Clients check, so access.js stays the single gate.
 */
export function websiteGate(user, name, canOpenClients) {
  const route = websiteRoute(name);
  if (!route) return null;
  if (route.gate === 'platform') return user?.roleId === 'super-admin';
  if (user?.roleId !== 'admin') return false;
  return route.gate === 'company' || canOpenClients() === true;
}
