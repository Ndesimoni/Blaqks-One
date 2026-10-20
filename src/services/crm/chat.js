/** Team chat inside one company (docs/team-chat.md): channels and private direct messages. */
export function chatRoutes({ request, scope }) {
  const base = (workspace) => `${scope(workspace)}/chat`;
  const room = (workspace, id) => `${base(workspace)}/rooms/${encodeURIComponent(id)}`;
  const item = (workspace, id, message) =>
    `${room(workspace, id)}/messages/${encodeURIComponent(message)}`;
  return {
    chat: (workspace, signal) => request(base(workspace), { signal }),
    chatSummary: (workspace, signal) => request(`${base(workspace)}/summary`, { signal }),
    createChannel: (workspace, name) =>
      request(`${base(workspace)}/channels`, { method: 'POST', body: { name } }),
    openDirect: (workspace, memberId) =>
      request(`${base(workspace)}/direct`, { method: 'POST', body: { memberId } }),
    chatMessages: (workspace, id, before, signal) =>
      request(
        `${room(workspace, id)}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`,
        { signal },
      ),
    sendChat: (workspace, id, body) =>
      request(`${room(workspace, id)}/messages`, { method: 'POST', body: { body } }),
    editChat: (workspace, id, message, body) =>
      request(item(workspace, id, message), { method: 'PATCH', body: { body } }),
    deleteChat: (workspace, id, message) =>
      request(item(workspace, id, message), { method: 'DELETE' }),
    markChatRead: (workspace, id) => request(`${room(workspace, id)}/read`, { method: 'POST' }),
  };
}
