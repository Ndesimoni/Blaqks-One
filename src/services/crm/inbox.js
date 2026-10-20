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
    inboxSummary: (workspace, signal) => request(`${scope(workspace)}/inbox/summary`, { signal }),
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
    /** Email sending (E1b): reply, Start message and Send again. */
    replyToConversation: action('messages'),
    startConversation: (workspace, body) => request(base(workspace), { method: 'POST', body }),
    sendMessageAgain: (workspace, id, message) =>
      request(`${item(workspace, id)}/messages/${encodeURIComponent(message)}/again`, {
        method: 'POST',
      }),
    inboxRules: (workspace, signal) => request(`${scope(workspace)}/inbox/rules`, { signal }),
    saveInboxRules: (workspace, body) =>
      request(`${scope(workspace)}/inbox/rules`, { method: 'PUT', body }),
  };
}
