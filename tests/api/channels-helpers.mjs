/** Shared fixtures for the channel-connection API suite (packet X1). */
export const channelPath = (session, suffix = '') =>
  `/workspaces/${session.user.workspaceId}/channels${suffix}`;

export const connection = (overrides = {}) => ({
  channel: 'whatsapp',
  provider: 'twilio',
  label: 'Synthetic studio line',
  externalAccountId: '+971500000001',
  credential: 'synthetic-credential',
  ...overrides,
});

export const connect = (session, overrides = {}) =>
  session.request(channelPath(session), {
    method: 'POST',
    body: { connection: connection(overrides) },
  });
