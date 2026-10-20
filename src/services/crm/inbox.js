/** Connected Inbox (docs/messaging-design.md §12): conversations, triage and lead rules. */
const query = (params = {}) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ).toString();
  return search ? `?${search}` : '';
};

export function inboxRoutes({ request, scope }) {
  const base = (workspace) => `${scope(workspace)}/inbox/conversations`;
  const item = (workspace, id) => `${base(workspace)}/${encodeURIComponent(id)}`;
  const action = (name) => (workspace, id, body) =>
    request(`${item(workspace, id)}/${name}`, { method: 'POST', body });
  return {
    conversations: (workspace, params, signal) =>
      request(`${base(workspace)}${query(params)}`, { signal }),
    conversation: (workspace, id, signal) => request(item(workspace, id), { signal }),
    updateConversation: (workspace, id, body) =>
      request(item(workspace, id), { method: 'PATCH', body }),
    markConversationRead: (workspace, id) =>
      request(`${item(workspace, id)}/read`, { method: 'POST' }),
    addConversationNote: action('notes'),
    createLeadFromConversation: action('lead'),
    linkConversation: action('link'),
    resolveConversation: action('resolve'),
    blockConversation: action('block'),
    unblockConversation: action('unblock'),
    inboxRules: (workspace, signal) => request(`${scope(workspace)}/inbox/rules`, { signal }),
    saveInboxRules: (workspace, body) =>
      request(`${scope(workspace)}/inbox/rules`, { method: 'PUT', body }),
  };
}
