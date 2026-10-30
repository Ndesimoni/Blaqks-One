export const TEAM_STORAGE = 'kws-crm-team-preview-v1';
export const OWNER_ROLE = 'super-admin';
export const INVITATION_DAYS = 7;
export const permissionFields = [
  {
    key: 'relationships',
    label: 'Leads, clients & contacts',
    detail: 'Manage enquiries and relationships.',
  },
  {
    key: 'properties',
    label: 'Properties & shortlists',
    detail: 'Manage the portfolio and property matches.',
  },
  {
    key: 'schedule',
    label: 'Appointments & follow-ups',
    detail: 'Manage calls, meetings, viewings and client care.',
  },
  {
    key: 'finance',
    label: 'Deals, payments & expenses',
    detail: 'Access financial records and commissions.',
  },
  {
    key: 'reports',
    label: 'Insights & reports',
    detail: 'Access CRM intelligence, date search and performance.',
  },
  {
    key: 'exports',
    label: 'Imports & exports',
    detail: 'Use workbook imports, backups and workspace data tools.',
  },
];

const access = (...keys) =>
  Object.fromEntries(permissionFields.map(({ key }) => [key, keys.includes(key)]));
const fullAccess = access(...permissionFields.map(({ key }) => key));
export const builtInRoles = [
  {
    id: OWNER_ROLE,
    name: 'Super Admin',
    description: 'Full CRM access, team management and role control.',
    builtIn: true,
    permissions: fullAccess,
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Full CRM operations in their own workspace, including finance and reports.',
    builtIn: true,
    permissions: fullAccess,
  },
  {
    id: 'receptionist',
    name: 'Receptionist',
    description: 'Enquiries, contacts, appointments and follow-ups.',
    builtIn: true,
    permissions: access('relationships', 'schedule'),
  },
  {
    id: 'staff',
    name: 'Staff / Agent',
    description: 'Clients, properties, appointments and follow-ups.',
    builtIn: true,
    permissions: access('relationships', 'properties', 'schedule'),
  },
];

export const routePermissions = {
  Leads: 'relationships',
  Clients: 'relationships',
  Contacts: 'relationships',
  'Client desk': 'relationships',
  Properties: 'properties',
  Shortlist: 'properties',
  'Follow-ups': 'schedule',
  Viewings: 'schedule',
  'Interaction log': 'schedule',
  'Client care': 'schedule',
  Deals: 'finance',
  Payments: 'finance',
  Expenses: 'finance',
  'CRM insights': 'reports',
  'Date search': 'reports',
  Performance: 'reports',
};

export function defaultChannelAccess(roleId) {
  const allowed = [OWNER_ROLE, 'admin'].includes(roleId);
  return { whatsapp: allowed, email: allowed };
}
