/**
 * Deal hand-over routes under `/finance` (finance-design §13 H-F1; agreements design §14,
 * §17 "H2 API contract"). Bodies are exact because the server refuses unknown keys: shares are
 * basis points and `metadata` is the parsed deal view's `{ id, version }`.
 */
const handoverDecisions = ['accept', 'decline', 'cancel'];
const segment = (value) => encodeURIComponent(value);

export function financeHandoverRoutes(base, send, request) {
  const handover = (workspace, id, action) =>
    `${base(workspace)}/handovers/${segment(id)}/${action}`;
  return {
    /**
     * The holder offers the deal to `toId`, fully or keeping a referral share (null = full).
     * `approverId` asks that person to approve after the receiver accepts; the key is left
     * out when no approval is needed.
     */
    requestHandover: (workspace, metadata, toId, referralShareBp, approverId) =>
      send(`${base(workspace)}/deals/${segment(metadata.id)}/handovers`, 'POST', {
        version: metadata.version,
        toId,
        referralShareBp: referralShareBp ?? null,
        ...(approverId ? { approverId } : {}),
      }),
    /** The company's Admin and staff with the Finance Approve right, without the caller. */
    financeApprovers: (workspace, signal) => request(`${base(workspace)}/approvers`, { signal }),
    /** The server-shaped review of an open hand-over: deal, property facts and client name. */
    handoverPreview: (workspace, id, signal) =>
      request(`${base(workspace)}/handovers/${segment(id)}/preview`, { signal }),
    /** The caller's `{ answer, approve }` counts for the Deals badge. */
    handoversWaiting: (workspace, signal) =>
      request(`${base(workspace)}/handovers/waiting`, { signal }),
    /**
     * Receiver accept/decline, requester or Admin cancel. Accepting an offer recorded as an
     * agreement names the agreement version the receiver was shown (agreements §14).
     */
    decideHandover: (workspace, id, decision, agreementVersion) => {
      if (!handoverDecisions.includes(decision)) throw new Error('Unknown hand-over decision.');
      const body = decision === 'accept' && agreementVersion ? { agreementVersion } : undefined;
      return send(handover(workspace, id, decision), 'POST', body);
    },
    /** Admin approval in place of the receiver, optionally adjusting the share, with a reason. */
    approveHandover: (workspace, id, referralShareBp, reason, agreementVersion) =>
      send(handover(workspace, id, 'approve'), 'POST', {
        referralShareBp: referralShareBp ?? null,
        reason,
        agreementVersion: agreementVersion ?? null,
      }),
    /** The chosen approver (or the Admin) approves an accepted hand-over; the deal moves. */
    approveAcceptance: (workspace, id, agreementVersion) =>
      send(handover(workspace, id, 'approve-acceptance'), 'POST', {
        agreementVersion: agreementVersion ?? null,
      }),
    /** The chosen approver (or the Admin) rejects an accepted hand-over; it is cancelled. */
    rejectAcceptance: (workspace, id) =>
      send(handover(workspace, id, 'reject-acceptance'), 'POST', undefined),
  };
}
