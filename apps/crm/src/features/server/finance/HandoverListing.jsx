import React from 'react';
import { ListingView } from './ListingView.jsx';
import { useFinanceContext } from './useFinanceRequests.js';

/**
 * The listing in a hand-over review (agreements design §18): its photos and floor plans
 * load through the review's own file route.
 */
export function HandoverListing({ property, handoverId }) {
  const { workspaceId } = useFinanceContext();
  const file = (id) =>
    `/api/crm/workspaces/${encodeURIComponent(workspaceId)}/finance/handovers/${encodeURIComponent(handoverId)}/preview/files/${encodeURIComponent(id)}`;
  return <ListingView property={property} file={file} />;
}
