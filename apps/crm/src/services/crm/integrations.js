/** Connected channels and each member's mailbox; credentials never reach the browser. */
export function integrationRoutes({ request, scope }) {
  const base = (workspace) => `${scope(workspace)}/channels`;
  const item = (workspace, id) => `${base(workspace)}/${encodeURIComponent(id)}`;
  const addresses = (workspace) => `${scope(workspace)}/email-addresses`;
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
    /** Sending addresses on the company's SendGrid domain (E3a); Admin only. */
    emailAddresses: (workspace, signal) => request(addresses(workspace), { signal }),
    addEmailAddress: (workspace, address) =>
      request(addresses(workspace), { method: 'POST', body: { address } }),
    renameEmailAddress: (workspace, id, body) =>
      request(`${addresses(workspace)}/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    reserveEmailAddress: (workspace, id, body) =>
      request(`${addresses(workspace)}/${encodeURIComponent(id)}`, { method: 'DELETE', body }),
    /** Removes an address that was never used with clients (owner decision 2026-10-21). */
    removeEmailAddress: (workspace, id, body) =>
      request(`${addresses(workspace)}/${encodeURIComponent(id)}/remove`, { method: 'POST', body }),
  };
}
