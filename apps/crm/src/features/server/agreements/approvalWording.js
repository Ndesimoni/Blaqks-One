/**
 * How an `approved` event reads on the Agreements screen (agreements design §17, amendment 8).
 * Only in-company hand-overs are approved: by the company Admin (`admin_decision`) or by the
 * approver the sender chose (`approver_decision`). "In place of the agent's acceptance" is said
 * only when no `accepted` event exists for the same revision. Any other verification value is
 * not trusted for wording and reads as a plain approval.
 */
const deciders = { admin_decision: 'Admin', approver_decision: 'Approver' };

/** The catalogue key for `event` (an `approved` event) among all of the agreement's events. */
export function approvalKey(event, events = []) {
  const decider = deciders[event?.verification];
  if (!decider) return 'handoverOffer.approvedUnknown';
  const accepted = events.some(
    (other) => other.action === 'accepted' && other.revision === event.revision,
  );
  return `handoverOffer.approvedBy${decider}${accepted ? '' : 'InPlace'}`;
}

/** The latest `approved` event of `revision`, or undefined. */
export const approvalOf = (events, revision) =>
  events?.findLast((event) => event.action === 'approved' && event.revision === revision);

/** True while the receiver's acceptance of the current revision waits for approval. */
export const awaitingApproval = (agreement, events, revision) =>
  agreement.state === 'sent' &&
  Boolean(events?.some((event) => event.action === 'accepted' && event.revision === revision));
