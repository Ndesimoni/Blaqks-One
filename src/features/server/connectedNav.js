import { nav } from '../../config/navigation.js';
import { canManageTeam, canOpenSection } from './access.js';

/** Existing route names keep their icons; connected-only destinations reuse a related icon. */
const sharedIcons = Object.fromEntries(nav.flatMap((group) => group.items));
const extraIcons = {
  'My profile': 'person',
  'Team & access': 'shield',
  Channels: 'chat',
  'Inbox rules': 'sliders',
  'My mailbox': 'note',
  'My activity': 'clock',
  'Team activity': 'clock',
  'Team chat': 'users',
  Agreements: 'note',
  Marketplace: 'layers',
  Workspaces: 'building',
  'Marketplace applications': 'layers',
};
export const navIcons = { ...sharedIcons, ...extraIcons };

/**
 * Display groups for the connected sidebar (UI pattern specification §2). These are groups,
 * not new routes: every item is an existing route name filtered by `canOpenSection`.
 */
export const displayGroups = [
  { key: 'overview', items: ['Dashboard'] },
  { key: 'relationships', items: ['Leads', 'Clients', 'Contacts', 'Client desk'] },
  { key: 'inventory', items: ['Properties', 'Shortlist', 'Marketplace', 'Agreements'] },
  {
    key: 'work',
    items: [
      'Follow-ups',
      'Viewings',
      'Inbox',
      'Team chat',
      'Messages',
      'Interaction log',
      'Client care',
    ],
  },
  {
    key: 'finance',
    items: ['Deals', 'Payments', 'Expenses', 'Performance', 'Date search', 'CRM insights'],
  },
  { key: 'resources', items: ['Calculators', 'Guide'] },
  { key: 'personal', pinned: true, items: ['My profile', 'My mailbox', 'Team activity'] },
  {
    key: 'company',
    pinned: true,
    items: ['Team & access', 'Team activity', 'Channels', 'Inbox rules', 'Workspaces'],
  },
  { key: 'platform', pinned: true, items: ['Workspaces', 'Marketplace applications'] },
];

const isAllowed = (user, name, groupKey) => {
  if (!canOpenSection(user, name)) return false;
  // Members see the Inbox where the Super Admin keeps the messaging preview.
  if (name === 'Messages') return !canOpenSection(user, 'Inbox');
  // One entry per route: managers read Team activity under company settings, staff read their
  // own actions under personal account.
  if (name === 'Team activity') return groupKey === (canManageTeam(user) ? 'company' : 'personal');
  // Workspaces follows the viewer's authority, and appears in exactly one group.
  if (name === 'Workspaces')
    return groupKey === (user?.roleId === 'super-admin' ? 'platform' : 'company');
  return true;
};

/** Groups with their permitted destinations, empty groups removed. Order is fixed. */
export function connectedGroups(user) {
  return displayGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((name) => isAllowed(user, name, group.key)),
    }))
    .filter((group) => group.items.length);
}

/** Sidebar labels that differ from the route name; the page heading stays authoritative. */
export function navLabel(user, name) {
  if (name === 'Team & access') return 'Team';
  return name === 'Team activity' && !canManageTeam(user) ? 'My activity' : name;
}
