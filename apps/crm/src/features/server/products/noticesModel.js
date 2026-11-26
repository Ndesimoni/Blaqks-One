/**
 * The bell's rows (NAV5, Bitrix24's notifications): only what is waiting for this person, each
 * with the page where it is handled. Unread Client inbox and Team chat messages keep their own
 * header badges, as Bitrix24 keeps chat counters apart from notifications.
 */
const kinds = [
  { key: 'mentions', tab: 'mentions', icon: 'chat', route: 'Team chat' },
  { key: 'handovers', tab: 'approvals', icon: 'briefcase', route: 'Deals' },
  { key: 'agreements', tab: 'approvals', icon: 'layers', route: 'Agreements' },
  { key: 'applications', tab: 'approvals', icon: 'layers', route: 'Marketplace applications' },
  { key: 'clients', tab: 'shared', icon: 'users', route: 'Clients' },
  { key: 'properties', tab: 'shared', icon: 'building', route: 'Properties' },
  { key: 'contacts', tab: 'shared', icon: 'person', route: 'Contacts' },
];

/** The panel's tabs; shared records show under All only. */
export const NOTICE_TABS = ['all', 'mentions', 'approvals'];

/** Rows for the non-zero counts on pages this person may open, in a fixed order. */
export function noticeRows(counts, canOpen) {
  return kinds
    .filter((kind) => counts[kind.key] > 0 && canOpen(kind.route))
    .map((kind) => ({ ...kind, count: counts[kind.key] }));
}

/** The rows a tab shows: every row under All, else the rows of that tab. */
export const rowsForTab = (rows, tab) =>
  tab === 'all' ? rows : rows.filter((row) => row.tab === tab);

/** Everything waiting, for the bell's badge. */
export const noticeTotal = (rows) => rows.reduce((sum, row) => sum + row.count, 0);
