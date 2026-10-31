/**
 * Interaction log deal links (finance-design §6.3, §17). Choices mirror the server's finance
 * predicate: team finance may link any deal in the workspace, the own view only deals the
 * caller holds, and members without finance cannot choose a new link at all. A stored value
 * the caller cannot open is labelled "Linked deal unavailable", never explained.
 */
import { referenceName } from '../finance/dealFilters.js';

export const DEAL_FIELD = 'deal_id_optional';
export const DEAL_LINK_MISSING =
  'The linked deal is missing from this workspace. Choose another deal or clear it.';
export const DEAL_UNAVAILABLE = 'Linked deal unavailable';

/** Deals the caller may link: `[{ id, label }]`, sorted by deal ID. */
export function dealLinkOptions(overview, access, userId) {
  if (!overview || access?.scope === 'none' || !access) return [];
  const linkable =
    access.scope === 'team'
      ? overview.deals
      : overview.deals.filter((deal) => userId && deal.assignee?.id === userId);
  return linkable
    .map((deal) => {
      const client = referenceName(overview.references, 'Clients', deal.clientId);
      return {
        id: deal.dealId,
        label: [deal.dealId, client || deal.clientId, deal.stage].filter(Boolean).join(' · '),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** Text for the form's current value when it is not one of the caller's choices. */
export function storedDealLabel(value, loading) {
  if (!value) return '';
  return loading ? value : `${value} · ${DEAL_UNAVAILABLE}`;
}

/** True for the identical 409 the server returns for any refused deal link. */
export const isDealLinkMissing = (error) =>
  error?.status === 409 &&
  error.details?.code === 'link_missing' &&
  error.message === DEAL_LINK_MISSING;
