/** Connected channel connections; credentials are write-only (docs/messaging-design.md). */
export function integrationRoutes({ request, scope }) {
  const base = (workspace) => `${scope(workspace)}/channels`;
  const item = (workspace, id) => `${base(workspace)}/${encodeURIComponent(id)}`;
  return {
    channels: (workspace, signal) => request(base(workspace), { signal }),
    connectChannel: (workspace, body) => request(base(workspace), { method: 'POST', body }),
    reconnectChannel: (workspace, id, body) =>
      request(`${item(workspace, id)}/reconnect`, { method: 'POST', body }),
    disconnectChannel: (workspace, id, body) =>
      request(item(workspace, id), { method: 'DELETE', body }),
  };
}
