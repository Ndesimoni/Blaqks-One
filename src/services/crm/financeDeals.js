/**
 * Deal and hand-over routes under `/finance` (finance-design §6.2, §13 H-F1, §15.5–§15.6).
 * Bodies are exact because the server refuses unknown keys: money is integer fils, shares
 * basis points, and `metadata` is the parsed view's `{ id, version }`.
 */
export const pick = (source, keys) =>
  Object.fromEntries(
    keys.filter((key) => source?.[key] !== undefined).map((key) => [key, source[key]]),
  );
export const segment = (value) => encodeURIComponent(value);

export const dealKeys = [
  'clientId',
  'propertyId',
  'dealType',
  'stage',
  'agreedValueFils',
  'feeBasis',
  'feeRateBp',
  'fixedFeeFils',
  'partnerShareBp',
  'partnerName',
  'details',
];
/** Optional revise changes (§15.5); the second agent and their share travel together. */
const reviseKeys = ['primaryAgentId', 'agreementId', 'overrideAgentShareBp'];
const handoverDecisions = ['accept', 'decline', 'cancel'];

function reviseBody(metadata, reason, changes = {}) {
  const body = { version: metadata.version, reason, ...pick(changes, reviseKeys) };
  if (changes.secondAgentId !== undefined || changes.secondAgentShareBp !== undefined) {
    body.secondAgentId = changes.secondAgentId ?? null;
    body.secondAgentShareBp = changes.secondAgentShareBp ?? null;
  }
  return body;
}

export function financeDealRoutes(base, send, request) {
  const deal = (workspace, metadata, action = '') =>
    `${base(workspace)}/deals/${segment(metadata.id)}${action}`;
  const handover = (workspace, id, action) =>
    `${base(workspace)}/handovers/${segment(id)}/${action}`;
  return {
    createDeal: (workspace, draft) =>
      send(`${base(workspace)}/deals`, 'POST', { deal: pick(draft, dealKeys) }),
    updateDeal: (workspace, metadata, draft) =>
      send(deal(workspace, metadata), 'PATCH', {
        deal: pick(draft, dealKeys),
        version: metadata.version,
      }),
    splitDeal: (workspace, metadata, split) =>
      send(deal(workspace, metadata, '/split'), 'PUT', {
        version: metadata.version,
        secondAgentId: split.secondAgentId ?? null,
        secondAgentShareBp: split.secondAgentShareBp ?? null,
        overrideAgentShareBp: split.overrideAgentShareBp ?? null,
        reason: split.reason ?? null,
      }),
    /** `GET …/earn-preview?earnedOn=` (approvers): what earning on that date would record. */
    earnPreview: (workspace, metadata, earnedOn, signal) =>
      request(deal(workspace, metadata, `/earn-preview?earnedOn=${segment(earnedOn)}`), {
        signal,
      }),
    earnDeal: (workspace, metadata, earnedOn) =>
      send(deal(workspace, metadata, '/earn'), 'POST', { version: metadata.version, earnedOn }),
    reviseDeal: (workspace, metadata, reason, changes) =>
      send(deal(workspace, metadata, '/revise'), 'POST', reviseBody(metadata, reason, changes)),
    unearnDeal: (workspace, metadata, reason) =>
      send(deal(workspace, metadata, '/unearn'), 'POST', { version: metadata.version, reason }),
    deleteDeal: (workspace, metadata) =>
      send(deal(workspace, metadata), 'DELETE', { version: metadata.version }),
    /** Admin only (§13 H-F1): moving a deal between people or to the queue needs a reason. */
    assignDeal: (workspace, metadata, assigneeId, reason) =>
      send(deal(workspace, metadata, '/assignee'), 'PUT', {
        version: metadata.version,
        assigneeId: assigneeId ?? null,
        reason: reason ?? '',
      }),
    financeAssignees: (workspace, signal) => request(`${base(workspace)}/assignees`, { signal }),
    /** The holder offers the deal to `toId`, fully or keeping a referral share (null = full). */
    requestHandover: (workspace, metadata, toId, referralShareBp) =>
      send(deal(workspace, metadata, '/handovers'), 'POST', {
        version: metadata.version,
        toId,
        referralShareBp: referralShareBp ?? null,
      }),
    /**
     * Receiver accept/decline, requester or Admin cancel. Accepting an offer recorded as an
     * agreement names the agreement version the receiver was shown (agreements §14).
     */
    decideHandover: (workspace, id, decision, agreementVersion) => {
      if (!handoverDecisions.includes(decision)) throw new Error('Unknown hand-over decision.');
      const body = decision === 'accept' && agreementVersion ? { agreementVersion } : undefined;
      return send(handover(workspace, id, decision), 'POST', body);
    },
    /** Admin approval, optionally adjusting the referral share, with a reason. */
    approveHandover: (workspace, id, referralShareBp, reason, agreementVersion) =>
      send(handover(workspace, id, 'approve'), 'POST', {
        referralShareBp: referralShareBp ?? null,
        reason,
        agreementVersion: agreementVersion ?? null,
      }),
  };
}
