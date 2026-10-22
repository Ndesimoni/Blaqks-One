/**
 * Pure agreement rules for the screens (docs/agreements-design.md §4, §9, §13). They mirror
 * the server so the screen offers exactly the commands it would accept; the server still
 * decides every command.
 */
export const KINDS = ['handover_full', 'handover_referral', 'co_broking'];
export const TABS = ['incoming', 'sent', 'all'];

const opposite = (side) => (side === 'sender' ? 'recipient' : 'sender');

/** 'sent' when the caller's company sends the agreement, otherwise 'incoming'. */
export const direction = (agreement, workspaceId) =>
  agreement.senderWorkspaceId === workspaceId ? 'sent' : 'incoming';

export const filterByTab = (agreements, tab, workspaceId) =>
  tab === 'all'
    ? agreements
    : agreements.filter((agreement) => direction(agreement, workspaceId) === tab);

/** The caller company's side of the agreement, and the other company's side. */
export const ownSide = (agreement, workspaceId) =>
  direction(agreement, workspaceId) === 'sent' ? 'sender' : 'recipient';
export const otherSide = (agreement, workspaceId) => opposite(ownSide(agreement, workspaceId));

/** The other company's named participant: `{ name, company }`. */
export const counterparty = (agreement, workspaceId) =>
  agreement.parties?.[otherSide(agreement, workspaceId)] ?? {};

/** The caller's named role ('sender' or 'recipient'), or null for a non-party Admin. */
export function partyOf(agreement, user) {
  if (agreement.senderWorkspaceId === user.workspaceId && agreement.senderMemberId === user.id)
    return 'sender';
  if (
    agreement.recipientWorkspaceId === user.workspaceId &&
    agreement.recipientMemberId === user.id
  )
    return 'recipient';
  return null;
}

/** A side's share in basis points from a revision's money or a list summary. */
export const shareOf = (money, side) =>
  money?.[side === 'sender' ? 'senderShareBp' : 'recipientShareBp'];

/** A share of the agreed amount in whole fils, rounded half up, for display only. */
export function shareFils(amountFils, bp) {
  if (!Number.isSafeInteger(amountFils) || !Number.isSafeInteger(bp)) return null;
  return Number((BigInt(amountFils) * BigInt(bp) * 2n + 10_000n) / 20_000n);
}

/** Whoever did not write the current revision answers it. */
export const responder = (authorParty) => opposite(authorParty || 'sender');

/**
 * What `party` may do now, mirroring the server: the sender revises and sends a draft; a
 * sent, unexpired revision is accepted, declined or countered by whoever did not write it;
 * the sender may revoke any sent offer, even an expired one. Admins act for no one.
 */
export function allowedActions({ agreement, authorParty, party }) {
  if (!agreement || !party) return [];
  if (agreement.state === 'draft') return party === 'sender' ? ['revise', 'send'] : [];
  if (agreement.state !== 'sent') return [];
  const actions = [];
  if (!agreement.expired && party === responder(authorParty))
    actions.push('accept', 'decline', 'counter');
  if (party === 'sender') actions.push('revoke');
  return actions;
}

/** The status shown in lists and the detail: a stored state, or expired or countered. */
export function displayState(agreement, authorParty) {
  if (agreement.state !== 'sent') return agreement.state;
  if (agreement.expired) return 'expired';
  return authorParty === 'recipient' ? 'countered' : 'sent';
}

const TONES = {
  draft: 'slate',
  sent: 'amber',
  countered: 'amber',
  accepted: 'green',
  completed: 'green',
  declined: 'red',
  revoked: 'red',
  expired: 'red',
  cancelled: 'red',
};
export const stateTone = (state) => TONES[state] || 'slate';

/** Whose move it is, from the caller's point of view. */
export function turn(agreement, party, authorParty) {
  if (agreement.state === 'draft') return party === 'sender' ? 'yourDraft' : 'draft';
  if (agreement.state !== 'sent') return 'closed';
  if (agreement.expired) return 'expired';
  if (!party) return 'waiting';
  return party === responder(authorParty) ? 'yourAnswer' : 'theirAnswer';
}

/** Newest first: the server's order, kept stable for equal timestamps. */
export const byUpdated = (agreements) =>
  [...agreements].sort((left, right) => (right.updatedAt || '').localeCompare(left.updatedAt));
