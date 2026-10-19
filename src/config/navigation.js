import { preferredCols } from './tableColumns.js';

const nav = [
  {
    header: 'WORKSPACE',
    items: [
      ['Dashboard', 'grid'],
      ['Client desk', 'search'],
      ['Messages', 'chat'],
      ['CRM insights', 'sparkle'],
    ],
  },
  {
    header: 'SALES & RELATIONSHIPS',
    items: [
      ['Leads', 'target'],
      ['Clients', 'users'],
      ['Contacts', 'person'],
      ['Properties', 'building'],
      ['Deals', 'briefcase'],
      ['Follow-ups', 'calendar'],
      ['Viewings', 'home'],
      ['Shortlist', 'target'],
      ['Interaction log', 'chat'],
      ['Client care', 'heart'],
    ],
  },
  {
    header: 'FINANCE & ANALYTICS',
    items: [
      ['Payments', 'wallet'],
      ['Expenses', 'money'],
      ['Date search', 'clock'],
      ['Performance', 'chart'],
    ],
  },
  {
    header: 'RESOURCES',
    items: [
      ['Calculators', 'money'],
      ['Guide', 'help'],
    ],
  },
];

const labels = {
  Workspaces: 'All workspaces',
  'Team activity': 'Team activity',
  Messages: 'Messages',
  'Team & access': 'Team & access',
  'My profile': 'My profile & messaging',
  Dashboard: 'Overview',
  Leads: 'Leads & sources',
  Deals: 'Deals & commissions',
  Clients: 'Clients & requirements',
  Contacts: 'Owners & contacts',
  Properties: 'Property portfolio',
  'Follow-ups': 'Follow-ups & daily tasks',
  Viewings: 'Viewings & feedback',
  Payments: 'Commission receipts',
  Expenses: 'Business expenses',
  Shortlist: 'Property shortlist',
  'Client desk': 'Client search & matching',
  'Date search': 'Search by date',
  Performance: 'Performance & targets',
  'Interaction log': 'Communication history',
  'Client care': 'Client relationships',
  'CRM insights': 'CRM intelligence',
  Calculators: 'Calculators',
  Guide: 'Getting started',
};

const descriptions = {
  Workspaces: 'Review each member’s workspace and open their CRM records.',
  'Team activity': 'See who changed CRM records and reviewed message previews, and when.',
  Messages: 'Start a message by email or WhatsApp for one or several recipients.',
  'Team & access': 'Invite your team, assign roles and control client messaging access.',
  'My profile': 'Update your contact details and review account access and sender connections.',
  Leads: 'Track enquiries, contact details, and where every lead came from.',
  Clients: 'Manage relationships, qualification, budgets, and conversion.',
  Contacts:
    'A single record for every landlord, client, owner, developer, broker and building contact.',
  Properties: 'Organize listings, pricing, availability, and permit tracking.',
  Deals: 'Manage each transaction from offer to completion and commission.',
  'Follow-ups': 'Stay in touch and never miss an important next action.',
  Viewings: 'Plan appointments, log feedback, and progress interested buyers.',
  Shortlist: 'Match opportunities with the right clients.',
  Payments: 'Track commission payments and outstanding receipts.',
  Expenses: 'Understand what you spend to grow your business.',
  'Interaction log': 'The full story behind every client conversation.',
  'Client care': 'Turn one successful transaction into a lasting relationship.',
  Calculators: 'Estimate DLD, agency fees and VAT before a transaction.',
};

export { descriptions, labels, nav, preferredCols };
