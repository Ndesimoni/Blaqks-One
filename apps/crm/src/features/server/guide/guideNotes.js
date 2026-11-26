/**
 * "How it works" articles: how access and money work, kept from the earlier Guide's notes.
 * They describe rules rather than tasks, so they list `points` instead of steps.
 */
export const noteGuides = [
  {
    id: 'signing-in',
    topic: 'How it works',
    title: 'Signing in and workspaces',
    intro: 'Your account and the team workspace you work in.',
    points: [
      'Sign in with the account your Admin created for you; your session is kept on the server.',
      'Admins work in their own team workspace. Staff use the workspace of the Admin who invited them.',
      'The platform operator can open other teams, read-only where a team is archived.',
    ],
  },
  {
    id: 'who-sees',
    topic: 'How it works',
    title: 'Who sees which records',
    intro: 'What staff and Admins can see in the CRM.',
    points: [
      'Staff see only the clients and properties assigned to them, and the activity linked to those.',
      'New records are assigned to their creator. Hand a record on and you lose sight of it unless you hold whole-team access.',
      'Admins see their whole team and can filter by assignee. Hidden records never appear in counts or search.',
    ],
  },
  {
    id: 'money-rules',
    topic: 'How it works',
    title: 'Deals, payments and expenses',
    intro: 'Who records money, who approves it and who sees it.',
    points: [
      'Agents record and submit; the Admin, or someone the Admin trusts with approvals, approves. Only approved records count.',
      'Agents see their own deals and commission statement, never company totals or colleagues’ earnings.',
      'Amounts are in AED. Every financial change is kept in history.',
    ],
  },
  {
    id: 'targets',
    topic: 'How it works',
    title: 'Targets, team and messages',
    intro: 'Targets, team settings and where conversations happen.',
    points: [
      'Performance shows monthly targets set by your Admin against actuals worked out from your records.',
      'Admins manage staff, positions and permissions in Team & access.',
      'Messages holds client email and WhatsApp in the Client inbox, and your team’s conversations in Team chat.',
    ],
  },
];
