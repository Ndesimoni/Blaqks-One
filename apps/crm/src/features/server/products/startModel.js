/**
 * The start page (NAV, owner 2026-10-31): a greeting, one card per product with its main
 * actions, a Messages strip without counts (the rail and header already show them) and the
 * route the person used last. Actions are existing routes, offered only when allowed.
 */
export const START_ROUTE = 'Start';
const LAST_KEY = 'kws-last-route';

export const startCards = [
  { key: 'crm', actions: ['Dashboard', 'Leads', 'Follow-ups'] },
  { key: 'web', actions: ['Website'] },
  { key: 'market', actions: ['Marketplace', 'Agreements'] },
  { key: 'platform', actions: ['Workspaces', 'Marketplace applications'] },
];

export const messageLinks = ['Inbox', 'Team chat', 'Marketplace chats'];

/** Morning before noon, afternoon before six, evening after. */
export function greetingKey(hour) {
  if (hour < 12) return 'start.morning';
  return hour < 18 ? 'start.afternoon' : 'start.evening';
}

/** The first name the greeting uses, or nothing for a name it cannot split. */
export const firstName = (name) =>
  String(name || '')
    .trim()
    .split(/\s+/)[0] || '';

// The last route is a per-tab convenience; storage may be unavailable.
export function rememberRoute(route) {
  try {
    sessionStorage.setItem(LAST_KEY, route);
  } catch {
    // Not remembered; the start page then offers no "Continue".
  }
}

export function lastRoute() {
  try {
    return sessionStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}
