/** Versioned agreement lifecycle and evidence requests; authorization stays on the server. */
export function agreementLifecycleRoutes({ request, item }) {
  const post = (workspace, id, path, body) =>
    request(`${item(workspace, id)}/${path}`, { method: 'POST', body });
  const command = (path) => (workspace, id, expectedVersion) =>
    post(workspace, id, path, { expectedVersion });
  const answer = (path) => (workspace, id, expectedVersion, revisionId) =>
    post(workspace, id, path, { expectedVersion, revisionId });
  return {
    amendAgreement: (workspace, id, expectedVersion, terms) =>
      post(workspace, id, 'amend', { expectedVersion, terms }),
    acceptAgreementAmendment: answer('amend/accept'),
    declineAgreementAmendment: answer('amend/decline'),
    completeAgreement: command('complete'),
    cancelAgreement: command('cancel'),
    archiveAgreement: command('archive'),
    agreementCertificate: (workspace, id, signal) =>
      request(`${item(workspace, id)}/certificate`, { signal }),
    agreementPayments: (workspace, id, signal) =>
      request(`${item(workspace, id)}/payments`, { signal }),
    recordAgreementPayment: (workspace, id, expectedVersion, payment) =>
      post(workspace, id, 'payments', { expectedVersion, ...payment }),
    confirmAgreementPayment: (workspace, id, expectedVersion, paymentId) =>
      post(workspace, id, `payments/${encodeURIComponent(paymentId)}/confirm`, { expectedVersion }),
    withdrawAgreementPayment: (workspace, id, expectedVersion, paymentId) =>
      post(workspace, id, `payments/${encodeURIComponent(paymentId)}/withdraw`, {
        expectedVersion,
      }),
  };
}
