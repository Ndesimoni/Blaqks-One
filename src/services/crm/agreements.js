/**
 * Cross-company deal agreements (docs/agreements-design.md §10, §13). Every command sends
 * the agreement's `expectedVersion`; the server answers with the new state and version.
 */
export function agreementRoutes({ request, scope }) {
  const base = (workspace) => `${scope(workspace)}/agreements`;
  const item = (workspace, id) => `${base(workspace)}/${encodeURIComponent(id)}`;
  const command = (name) => (workspace, id, expectedVersion) =>
    request(`${item(workspace, id)}/${name}`, { method: 'POST', body: { expectedVersion } });
  const withTerms = (name) => (workspace, id, expectedVersion, terms) =>
    request(`${item(workspace, id)}/${name}`, {
      method: 'POST',
      body: { expectedVersion, terms },
    });
  return {
    agreements: (workspace, signal) => request(base(workspace), { signal }),
    agreement: (workspace, id, signal) => request(item(workspace, id), { signal }),
    /** `{ answer }`: offers from other companies waiting for the caller (sidebar badge). */
    agreementsWaiting: (workspace, signal) => request(`${base(workspace)}/waiting`, { signal }),
    /** The named recipient of a new agreement, by their exact sign-in email. */
    findAgreementRecipient: (workspace, email) =>
      request(`${base(workspace)}/recipients`, { method: 'POST', body: { email } }),
    createAgreement: (workspace, agreement) =>
      request(base(workspace), { method: 'POST', body: { agreement } }),
    reviseAgreement: (workspace, id, expectedVersion, terms) =>
      request(item(workspace, id), { method: 'PATCH', body: { expectedVersion, terms } }),
    sendAgreement: command('send'),
    acceptAgreement: command('accept'),
    declineAgreement: command('decline'),
    revokeAgreement: command('revoke'),
    counterAgreement: withTerms('counter'),
  };
}
