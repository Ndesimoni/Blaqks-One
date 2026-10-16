/**
 * Words and icons for activity: CRM sections, record actions and team actions. Labels follow the
 * navigation's terms and icons; nothing here comes from the server.
 */
export const sections = {
  Clients: { noun: 'client', icon: 'users' },
  Contacts: { noun: 'contact', icon: 'person' },
  Properties: { noun: 'property', icon: 'building' },
  'Follow-ups': { noun: 'follow-up', icon: 'calendar' },
  Viewings: { noun: 'viewing', icon: 'home' },
  Shortlist: { noun: 'shortlist match', icon: 'target' },
  'Interaction log': { noun: 'interaction', icon: 'chat' },
  'Client care': { noun: 'client care touchpoint', icon: 'heart' },
  Deals: { noun: 'deal', icon: 'briefcase' },
  Payments: { noun: 'payment', icon: 'wallet' },
  Expenses: { noun: 'expense', icon: 'money' },
  Targets: { noun: 'monthly target', icon: 'chart' },
};
export const recordSections = Object.keys(sections).slice(0, 8);
export const financeSections = ['Deals', 'Payments', 'Expenses'];

/** `verb` reads "Layla added client …"; `tone` colours the action badge. */
export const recordActions = {
  created: { label: 'Added', verb: 'added', icon: 'plus', tone: 'positive' },
  updated: { label: 'Updated', verb: 'updated', icon: 'edit', tone: 'neutral' },
  deleted: { label: 'Deleted', verb: 'deleted', icon: 'trash', tone: 'danger' },
  assigned: { label: 'Reassigned', verb: 'reassigned', icon: 'users', tone: 'neutral' },
  earned: { label: 'Earned', verb: 'earned', icon: 'money', tone: 'gold' },
  revised: { label: 'Revised', verb: 'revised', icon: 'edit', tone: 'gold' },
  unearned: { label: 'Earning reversed', verb: 'reversed earning on', icon: 'arrow', tone: 'gold' },
  approved: { label: 'Approved', verb: 'approved', icon: 'check', tone: 'positive' },
  rejected: { label: 'Rejected', verb: 'rejected', icon: 'close', tone: 'danger' },
  voided: { label: 'Voided', verb: 'voided', icon: 'close', tone: 'danger' },
};

/** Team events name a member: "Aidah invited Omar Haddad". */
export const teamActions = {
  invited: { label: 'Invited', verb: 'invited', icon: 'person', tone: 'accent' },
  activated: {
    label: 'Joined',
    verb: 'joined the team',
    icon: 'check',
    tone: 'positive',
    self: true,
  },
  updated: {
    label: 'Details updated',
    verb: 'updated the details of',
    icon: 'edit',
    tone: 'accent',
  },
  access_changed: {
    label: 'Access changed',
    verb: 'changed the access of',
    icon: 'shield',
    tone: 'accent',
  },
  suspended: { label: 'Suspended', verb: 'suspended', icon: 'lock', tone: 'danger' },
  archived: { label: 'Archived', verb: 'archived', icon: 'layers', tone: 'danger' },
};

const fallback = { label: 'Changed', verb: 'changed', icon: 'info', tone: 'neutral' };
export const actionOf = (item) =>
  (item.kind === 'team' ? teamActions : recordActions)[item.action] || fallback;

/**
 * Sections whose activity this member may filter by, mirroring the server's grants: record
 * modules, finance (team-scope staff need See team finance) and Targets with reports.
 */
export function sectionOptions(user, canOpen) {
  const manager = user?.roleId === 'admin' || user?.roleId === 'super-admin';
  const scope = user?.financeAccess?.scope;
  const finance = manager || scope === 'team' || (scope === 'own' && user?.recordScope !== 'team');
  return [
    ...recordSections.filter((name) => manager || canOpen(name)),
    ...(finance ? financeSections : []),
    ...(manager || user?.permissions?.reports === true ? ['Targets'] : []),
  ];
}

/** Action choices for the selected type; staff only ever see record actions. */
export function actionOptions(type, manager) {
  const record = Object.entries(recordActions);
  const team = Object.entries(teamActions).filter(([key]) => key !== 'updated');
  const entries = type === 'team' ? Object.entries(teamActions) : record;
  const options = type || !manager ? entries : [...record, ...team];
  return options.map(([value, action]) => ({ value, label: action.label }));
}
