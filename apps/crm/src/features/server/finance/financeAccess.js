/**
 * Effective finance access from the server profile's `financeAccess` (finance-design §5.1,
 * §14.2). The frontend never re-derives grants: a missing, malformed or unknown-role profile
 * denies everything, and inconsistent flags are narrowed, never widened.
 */
import { actionDeniedMessages } from '../access.js';

export const financeFlags = ['create', 'edit', 'assign', 'approve', 'teamView', 'manage'];

export const noFinanceAccess = Object.freeze({
  scope: 'none',
  create: false,
  edit: false,
  assign: false,
  approve: false,
  teamView: false,
  manage: false,
});

const roles = ['admin', 'super-admin', 'staff'];

/**
 * `{ scope: 'team'|'own'|'none', create, edit, assign, approve, teamView, manage }`. Only JSON
 * `true` grants a flag. Team scope needs `teamView`, approve needs team view, and `manage`
 * belongs to the Admin role only (§14.2: the Super Admin views, never manages).
 */
export function readFinanceAccess(user) {
  const access = user?.financeAccess;
  if (!roles.includes(user?.roleId) || !access || typeof access !== 'object')
    return noFinanceAccess;
  if (access.scope !== 'team' && access.scope !== 'own') return noFinanceAccess;
  const flag = (key) => access[key] === true;
  const teamView = access.scope === 'team' && flag('teamView');
  return Object.freeze({
    scope: teamView ? 'team' : 'own',
    create: flag('create'),
    edit: flag('edit'),
    assign: flag('assign'),
    approve: teamView && flag('approve'),
    teamView,
    manage: user.roleId === 'admin' && flag('manage'),
  });
}

/** True when the member may open finance at all (own or team view). */
export const canUseFinance = (user) => readFinanceAccess(user).scope !== 'none';

/** True when the effective access holds `flag` (one of `financeFlags`). */
export function canFinance(user, flag) {
  return financeFlags.includes(flag) && readFinanceAccess(user)[flag] === true;
}

/** Server-equivalent refusals (§6.1). Each depends only on the caller. */
export const financeDeniedMessages = Object.freeze({
  module: 'Access denied.',
  create: actionDeniedMessages.create,
  edit: actionDeniedMessages.edit,
  assign: actionDeniedMessages.assign,
  approve: "Your access doesn't include approving finance records.",
  teamView: 'Access denied.',
  manage: 'Only your Admin can change finance settings.',
});
