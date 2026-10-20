/** Connected channels and each member's mailbox; credentials never reach the browser. */
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
    /** Each member's own Google mailbox (E1a); the sign-in finishes on /oauth/google. */
    mailbox: (workspace, signal) => request(`${scope(workspace)}/mailbox`, { signal }),
    startGoogleSignIn: (workspace) =>
      request(`${scope(workspace)}/mailbox/google/start`, { method: 'POST', body: {} }),
    finishGoogleSignIn: (workspace, body) =>
      request(`${scope(workspace)}/mailbox/google/finish`, { method: 'POST', body }),
    disconnectMailbox: (workspace, body) =>
      request(`${scope(workspace)}/mailbox`, { method: 'DELETE', body }),
  };
}
