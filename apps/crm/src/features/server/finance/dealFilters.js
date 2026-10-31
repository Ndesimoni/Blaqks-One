/**
 * Deals list filters and display helpers (finance-design §7). Filters narrow deals already in
 * the caller's shaped overview; they never widen what the server returned.
 */
export const DEALS_PER_PAGE = 12;
export const earnedFilters = Object.freeze([
  { id: '', label: 'Any earned state' },
  { id: 'earned', label: 'Earned' },
  { id: 'unearned', label: 'Not earned' },
]);
export const QUEUE = 'queue';
export const emptyDealFilters = Object.freeze({ query: '', stage: '', earned: '', holder: '' });

const lower = (value) => String(value ?? '').toLowerCase();

/** A reference name (client or property) when the caller holds that module, else null. */
export function referenceName(references, collection, id) {
  if (!id) return null;
  return references?.[collection]?.find((row) => row.id === id)?.name ?? null;
}

/** `{ stage, earned, holder, query }`; `holder` is a member ID or `queue` (team view). */
export function filterDeals(deals, filters, references) {
  const query = lower(filters.query).trim();
  return deals.filter((deal) => {
    if (filters.stage && deal.stage !== filters.stage) return false;
    if (filters.earned === 'earned' && !deal.earnedOn) return false;
    if (filters.earned === 'unearned' && deal.earnedOn) return false;
    if (filters.holder === QUEUE && deal.assignee) return false;
    if (filters.holder && filters.holder !== QUEUE && deal.assignee?.id !== filters.holder)
      return false;
    if (!query) return true;
    const client = referenceName(references, 'Clients', deal.clientId);
    const property = referenceName(references, 'Properties', deal.propertyId);
    return [deal.dealId, deal.clientId, deal.propertyId, client, property, deal.assignee?.name]
      .map(lower)
      .some((value) => value.includes(query));
  });
}

/** True when any filter narrows the list (to offer a reset and distinguish "no results"). */
export const filtersActive = (filters) => Object.values(filters).some((value) => value !== '');

/** Clamps a page index to the available pages after filtering. */
export function clampPage(page, total, size = DEALS_PER_PAGE) {
  return Math.min(Math.max(0, page), Math.max(0, Math.ceil(total / size) - 1));
}

/** "Unassigned" queue label, or the holder's name. */
export const holderName = (assignee, me) =>
  !assignee ? 'Team queue' : assignee.id === me ? `${assignee.name ?? 'You'} (you)` : assignee.name;

/** Line labels: the own view says "Your commission"; the team view names each agent. */
export function lineLabel(line, team) {
  if (line.role === 'company') return 'Company share';
  if (!team) return line.role === 'second' ? 'Your second-agent share' : 'Your commission';
  const role = line.role === 'second' ? 'Second agent' : 'Deal holder';
  return line.agent?.name || line.name ? `${role} · ${line.agent?.name || line.name}` : role;
}

/** Earned state text (status never relies on colour alone). */
export const earnedLabel = (deal) => (deal.earnedOn ? 'Earned' : 'Not earned');
