/** Send only the selected server command; permission and lifecycle checks stay on the API. */
export function applyMarketplaceDecision(api, workspace, request, decision) {
  if (decision.action === 'reject')
    return api.rejectMarketplaceOffer(workspace, request.id, decision.id);
  if (decision.action === 'select')
    return api.selectMarketplaceAnswer(workspace, request.id, decision.id, request.version);
  if (decision.action === 'reopen')
    return api.reopenMarketplaceRequest(workspace, request.id, request.version);
  throw new Error('Unknown marketplace decision.');
}
