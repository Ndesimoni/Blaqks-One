/** Private marketplace request activity; every operation stays in the caller's scope. */
export function marketplaceActivityRoutes({ request, scope }) {
  const base = (workspace) => `${scope(workspace)}/marketplace`;
  const part = encodeURIComponent;
  const item = (workspace, id) => `${base(workspace)}/requests/${part(id)}`;
  return {
    marketplaceActivity: (workspace, signal) => request(`${base(workspace)}/activity`, { signal }),
    marketplaceOffers: (workspace, id, signal) =>
      request(`${item(workspace, id)}/offers`, { signal }),
    proposeMarketplaceAgreement: (workspace, id, terms) =>
      request(`${item(workspace, id)}/agreement`, { method: 'POST', body: { terms } }),
    previewMarketplaceOffer: (workspace, id, recordId) =>
      request(`${item(workspace, id)}/offers/preview`, { method: 'POST', body: { recordId } }),
    sendMarketplaceOffer: (workspace, id, body) =>
      request(`${item(workspace, id)}/offers`, { method: 'POST', body }),
    rejectMarketplaceOffer: (workspace, id, answer) =>
      request(`${item(workspace, id)}/offers/${part(answer)}/reject`, { method: 'POST' }),
    marketplaceConversations: (workspace, id, signal) =>
      request(`${item(workspace, id)}/conversations`, { signal }),
    startMarketplaceConversation: (workspace, id, body) =>
      request(`${item(workspace, id)}/conversations`, { method: 'POST', body: { body } }),
    marketplaceMessages: (workspace, id, signal) =>
      request(`${base(workspace)}/conversations/${part(id)}/messages`, { signal }),
    sendMarketplaceMessage: (workspace, id, body) =>
      request(`${base(workspace)}/conversations/${part(id)}/messages`, {
        method: 'POST',
        body: { body },
      }),
    marketplaceNotifications: (workspace, signal) =>
      request(`${base(workspace)}/notifications`, { signal }),
    selectMarketplaceAnswer: (workspace, id, answerId, expectedVersion) =>
      request(`${item(workspace, id)}/select`, {
        method: 'POST',
        body: { answerId, expectedVersion },
      }),
    reopenMarketplaceRequest: (workspace, id, expectedVersion) =>
      request(`${item(workspace, id)}/reopen`, {
        method: 'POST',
        body: { expectedVersion },
      }),
  };
}
