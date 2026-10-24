import { descriptions } from '../../config/navigation.js';

import { connectedCollections } from './records.js';

const connectedSections = new Set([
  ...connectedCollections,
  'Leads',
  'Team & access',
  'Dashboard',
  'Client desk',
  // Finance (finance-design §7): Deals, Payments and Expenses come from `GET /finance`.
  'Deals',
  'Payments',
  'Expenses',
  // Targets are served by `/performance/targets`; actuals come from scoped records and finance.
  'Performance',
  'CRM insights',
  'Date search',
  'Calculators',
  'Guide',
  // The member's own account under `/auth/account` and `/auth/sessions`.
  'My profile',
  // `GET /activity`: the whole workspace for managers, the member's own actions for staff.
  'Team activity',
  // `/channels`: the Admin's connections registry (packet X1).
  'Channels',
  // `/inbox`: the shared Inbox (packets X3, U1).
  'Inbox',
  // `/chat`: team channels and private messages (packets C1, C2).
  'Team chat',
  // `/inbox-rules`: the Admin's lead rules (packet U2).
  'Inbox rules',
  // `/mailbox`: each member's own Google mailbox (packets E1a, E1d).
  'My mailbox',
  'Google sign-in',
  // `/agreements`: cross-company deal agreements (packet A2 screens).
  'Agreements',
  // `/marketplace`: company eligibility, the switch and the platform's decisions (MK1).
  'Marketplace',
  'Marketplace applications',
]);
export const isConnectedSection = (name) => connectedSections.has(name);
export const isRecordSection = (name) => name === 'Leads' || connectedCollections.includes(name);

const purposes = {
  Dashboard: 'Review your business priorities and workspace overview.',
  'Client desk': 'Search client requirements and find suitable properties.',
  'CRM insights': 'Review opportunities and understand your CRM activity.',
  'Date search': 'Find workspace records by their dates.',
  Performance: 'Review targets and business performance.',
  Guide: 'Learn how to use your CRM workspace.',
  'My profile': 'Review your account, update your details and manage sign-in security.',
  Workspaces: 'Review the workspaces this account is permitted to open.',
  'Team activity': 'Review who changed what in this workspace, and when.',
  'My activity': 'Review the changes you have made in this workspace.',
  Marketplace:
    'Post what your clients are looking for; brokers with a matching property answer privately.',
  'Marketplace applications':
    'Companies that asked for marketplace access. You see their names, ages, who applied and the counts, never their records.',
};

export function sectionDescription(name) {
  return purposes[name] || descriptions[name] || 'Review your selected workspace.';
}
