// Finance action grants for connected staff (finance-design §5.1, §7, §13, §14.1).
// The server is authoritative; these helpers mirror its save rules in the member form.

/** Display order follows the dependency: See team finance comes before Approve. */
export const financeKeys = ['create', 'edit', 'assign', 'teamView', 'approve'];

export const financeLabels = {
  create: 'Add',
  edit: 'Edit',
  assign: 'Hand on',
  teamView: 'See team finance',
  approve: 'Approve payments & expenses',
};

/** Never granted by positions or invitations and flagged as sensitive in the review. */
export const sensitiveFinanceKeys = ['teamView', 'approve'];

export const needsTeamText = 'Needs whole-team visibility';
export const needsTeamFinanceText = 'Needs See team finance';

/** True when the (possibly unnormalised) form actions hold See team finance. */
export const hasTeamFinance = (form) =>
  form.recordScope === 'team' &&
  !!form.permissions?.finance &&
  form.actions?.finance?.teamView === true;

/** Why a finance tick is unavailable, or '' when it may be used. */
export function financeBlocker(key, form) {
  if (!sensitiveFinanceKeys.includes(key)) return '';
  if (form.recordScope !== 'team') return needsTeamText;
  if (key === 'approve' && form.actions?.finance?.teamView !== true) return needsTeamFinanceText;
  return '';
}

/** Help text under a sensitive finance tick: its blocker, or what the grant allows. */
export function financeHelp(key, form) {
  const blocker = financeBlocker(key, form);
  if (blocker) return blocker;
  return key === 'teamView'
    ? "Sensitive: shows every teammate's deals, payments, expenses and commission. Off by default."
    : 'Sensitive: approves or rejects payments and expenses and marks deals earned. Off by default.';
}

/**
 * Deleting clients and properties also needs See team finance, because deals link to them
 * (owner decision Q9, §13 L-F2). Contacts are not linked, so the clients & contacts tick still
 * deletes contacts without it; deleting properties has no effect without it.
 */
export function deleteMainFinanceBlocker(module, form) {
  if (module !== 'properties' || hasTeamFinance(form)) return '';
  return `${needsTeamFinanceText} under Finance`;
}

/** Extra guidance for the clients & contacts delete tick, or ''. */
export function clientDeleteNote(form) {
  return hasTeamFinance(form)
    ? ''
    : 'Deleting clients also needs See team finance under Finance; until then this deletes contacts only.';
}

/** Invitation guidance: the sensitive finance ticks are granted later, on the member. */
export const financeInvitationNote =
  'Seeing team finance and approving can be granted later, with whole-team visibility.';
