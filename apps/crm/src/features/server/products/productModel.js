import { isAllowed } from '../connectedNav.js';

/**
 * Navigation NAV (owner, 2026-10-31): the app is organised as products, each with sections in
 * a contextual sidebar, and each section's existing routes shown as header tabs. These are
 * groupings only: every route keeps its address and is filtered by the same `isAllowed` check
 * as the earlier grouped sidebar. `group` passes the sidebar group a route used to belong to,
 * for the routes that appear in exactly one of two places (Team activity and Workspaces).
 */
export const productList = [
  {
    key: 'crm',
    icon: 'users',
    sections: [
      { key: 'dashboard', routes: ['Dashboard'] },
      { key: 'leads', routes: ['Leads'] },
      { key: 'clients', routes: ['Clients', 'Client desk'] },
      { key: 'contacts', routes: ['Contacts'] },
      { key: 'properties', routes: ['Properties', 'Shortlist'] },
      { key: 'activities', routes: ['Follow-ups', 'Viewings', 'Interaction log', 'Client care'] },
      { key: 'money', routes: ['Deals', 'Payments', 'Expenses'] },
      { key: 'reports', routes: ['Performance', 'CRM insights', 'Date search'] },
      { key: 'tools', routes: ['Calculators', 'Guide'] },
    ],
  },
  {
    key: 'web',
    icon: 'monitor',
    sections: [
      { key: 'websiteContent', routes: ['Website'] },
      { key: 'websiteTeam', routes: ['Website team'] },
      { key: 'websiteListings', routes: ['Website properties'] },
      { key: 'websiteEnquiries', routes: ['Website enquiries'] },
    ],
  },
  {
    key: 'market',
    icon: 'layers',
    sections: [
      { key: 'board', routes: ['Marketplace'] },
      { key: 'requests', routes: ['My requests'] },
      { key: 'updates', routes: ['Marketplace updates'] },
      { key: 'agreements', routes: ['Agreements'] },
      { key: 'brokerProfile', routes: ['Broker profile'] },
    ],
  },
  {
    key: 'messages',
    icon: 'chat',
    sections: [
      { key: 'inbox', routes: ['Inbox', 'Messages'] },
      { key: 'teamChat', routes: ['Team chat'] },
    ],
  },
  {
    key: 'platform',
    icon: 'building',
    sections: [
      { key: 'workspaces', routes: ['Workspaces'], group: 'platform' },
      { key: 'applications', routes: ['Marketplace applications'] },
      { key: 'platformWebsite', routes: ['Platform website', 'Platform companies'] },
    ],
  },
  {
    key: 'settings',
    icon: 'sliders',
    sections: [
      { key: 'company', routes: ['Company'] },
      { key: 'team', routes: ['Team & access'] },
      { key: 'activity', routes: ['Team activity'], group: 'company' },
      { key: 'channels', routes: ['Channels'] },
      { key: 'inboxRules', routes: ['Inbox rules'] },
      { key: 'workspaces', routes: ['Workspaces'], group: 'company' },
      {
        key: 'profile',
        routes: ['My profile', 'Website profile', 'Sign-in and security'],
        personal: true,
      },
      { key: 'myActivity', routes: ['Team activity'], group: 'personal', personal: true },
      { key: 'mailbox', routes: ['My mailbox'], personal: true },
      { key: 'whatsapp', routes: ['My WhatsApp'], personal: true },
    ],
  },
];

/** Settings sits at the bottom of the product rail, apart from the products. */
export const BOTTOM_PRODUCT = 'settings';

const allowedRoutes = (user, section) =>
  section.routes.filter((name) => isAllowed(user, name, section.group || 'any'));

/** A product's sections with only the routes this person may open; empty sections removed. */
export function productSections(user, key) {
  const product = productList.find((item) => item.key === key);
  if (!product) return [];
  return product.sections
    .map((section) => ({ ...section, routes: allowedRoutes(user, section) }))
    .filter((section) => section.routes.length);
}

/** Products with at least one section this person may open, in rail order. */
export function visibleProducts(user) {
  return productList.filter((product) => productSections(user, product.key).length);
}

/** The product and section that hold `route` for this person, or null. */
export function locate(user, route) {
  for (const product of productList) {
    const section = productSections(user, product.key).find((item) => item.routes.includes(route));
    if (section) return { product: product.key, section };
  }
  return null;
}

/** Where a product opens: its remembered route when still allowed, else its first route. */
export function productEntry(user, key, remembered) {
  const sections = productSections(user, key);
  if (remembered && sections.some((section) => section.routes.includes(remembered)))
    return remembered;
  return sections[0]?.routes[0] || null;
}
