/** Connected Guide content: the steps, plus short notes on how access and money work. */
export const guideSteps = [
  ['01', 'Build your network', 'Add owners, developers and partner brokers.', 'Contacts', 'person'],
  [
    '02',
    'Manage your listings',
    'Record property details, terms and permit status.',
    'Properties',
    'building',
  ],
  [
    '03',
    'Qualify every lead',
    'Track sources, then capture budgets and urgency.',
    'Leads',
    'target',
  ],
  [
    '04',
    'Plan the next step',
    'Create follow-ups and log client conversations.',
    'Follow-ups',
    'calendar',
  ],
  [
    '05',
    'Create perfect matches',
    'Search requirements and shortlist properties.',
    'Client desk',
    'target',
  ],
  ['06', 'Arrange viewings', 'Log appointments and collect feedback.', 'Viewings', 'home'],
  ['07', 'Manage deals', 'Progress each deal and earn the commission.', 'Deals', 'briefcase'],
  ['08', 'Track the money', 'Submit fee receipts and expenses for approval.', 'Payments', 'wallet'],
  [
    '09',
    'Nurture long-term clients',
    'Schedule renewals, referrals and check-ins.',
    'Client care',
    'heart',
  ],
];

export const guideNotes = [
  {
    title: 'Signing in and workspaces',
    icon: 'lock',
    points: [
      'Sign in with the account your Admin created for you; your session is kept on the server.',
      'Admins work in their own team workspace. Staff use the workspace of the Admin who invited them.',
      'The platform operator can open other teams, read-only where a team is archived.',
    ],
  },
  {
    title: 'Who sees which records',
    icon: 'users',
    points: [
      'Staff see only the clients and properties assigned to them, and the activity linked to those.',
      'New records are assigned to their creator. Hand a record on and you lose sight of it unless you hold whole-team access.',
      'Admins see their whole team and can filter by assignee. Hidden records never appear in counts or search.',
    ],
  },
  {
    title: 'Deals, payments and expenses',
    icon: 'wallet',
    points: [
      'Agents record and submit; the Admin, or someone the Admin trusts with approvals, approves. Only approved records count.',
      'Agents see their own deals and commission statement, never company totals or colleagues’ earnings.',
      'Amounts are in AED. Every financial change is kept in history.',
    ],
  },
  {
    title: 'Targets, team and messages',
    icon: 'target',
    points: [
      'Performance shows monthly targets set by your Admin against actuals worked out from your records.',
      'Admins manage staff, positions and permissions in Team & access.',
      'Messages is not connected yet: email and WhatsApp cannot be sent from this CRM.',
    ],
  },
];
