/**
 * Sharing a listing with an agent at another company (docs/record-sharing.md R2, packet
 * R2a). Sending repeats the reviewed `previewDigest`; every command answers with the share's
 * view. The Super Admin and everyone outside a share get the same "not found".
 */
const actions = ['accept', 'decline', 'withdraw', 'stop'];
const sides = ['incoming', 'sent'];
const segment = (value) => encodeURIComponent(value);

export function agreementListingRoutes({ request, base }) {
  const shares = (workspace) => `${base(workspace)}/listing-shares`;
  const item = (workspace, id) => `${shares(workspace)}/${segment(id)}`;
  return {
    /** `{ before, after, files, warnings, previewDigest }`: what the agent will see. */
    previewListingShare: (workspace, recordId, exactLocation) =>
      request(`${shares(workspace)}/preview`, {
        method: 'POST',
        body: { recordId, exactLocation },
      }),
    /** `{ recordId, recipientWorkspaceId, recipientMemberId, viewEndsOn, exactLocation, note, previewDigest }`. */
    createListingShare: (workspace, share) =>
      request(shares(workspace), { method: 'POST', body: share }),
    listingShares: (workspace, side, signal) => {
      if (!sides.includes(side)) throw new Error('Unknown listing share side.');
      return request(`${shares(workspace)}?side=${side}`, { signal });
    },
    /** The shares of one listing the caller sent (the Admin: the company's). */
    recordListingShares: (workspace, recordId, signal) =>
      request(`${shares(workspace)}?recordId=${segment(recordId)}`, { signal }),
    listingShare: (workspace, id, signal) => request(item(workspace, id), { signal }),
    decideListingShare: (workspace, id, action, body) => {
      if (!actions.includes(action)) throw new Error('Unknown listing share action.');
      return request(`${item(workspace, id)}/${action}`, { method: 'POST', body });
    },
    extendListingShare: (workspace, id, viewEndsOn) =>
      request(`${item(workspace, id)}/extend`, { method: 'POST', body: { viewEndsOn } }),
    /** A co-broking draft from an accepted share, with the listing's facts fixed: `{ agreement }`. */
    proposeCoBroking: (workspace, id, terms) =>
      request(`${item(workspace, id)}/co-broking`, { method: 'POST', body: { terms } }),
    listingShareEvidence: (workspace, id) => request(`${item(workspace, id)}/evidence`),
    listingShareFileUrl: (workspace, id, file) =>
      `/api/crm${item(workspace, id)}/files/${segment(file)}`,
  };
}
