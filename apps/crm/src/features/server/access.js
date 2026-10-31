import { routePermissions } from '../../config/team.js';
import { findEntry, returnsOnly } from './assignment/assignmentModel.js';

export function canManageTeam(user) {
  return user?.roleId === 'admin' || user?.roleId === 'super-admin';
}

/** Companies are universal (B0), so Team features follow management access alone. */
export function hasTeamFeatures(user) {
  return canManageTeam(user);
}

/** Managers read the whole workspace's Team activity; staff read My activity (their own). */
export const activityLabel = (user) => (hasTeamFeatures(user) ? 'Team activity' : 'My activity');

export function canOpenSection(user, route) {
  if (!['admin', 'super-admin', 'staff'].includes(user?.roleId)) return false;
  if (route === 'Website') return user.roleId === 'admin';
  if (route === 'Platform website') return user.roleId === 'super-admin';
  if (['Team & access', 'Workspaces'].includes(route)) return canManageTeam(user);
  // Only the owning company Admin connects or disconnects channels (design §8).
  if (route === 'Channels') return user?.roleId === 'admin';
  // Company members only: the Super Admin never reads a company's conversations (design §11).
  if (route === 'Inbox') return user?.roleId !== 'super-admin';
  // Team chat is company-only too; private messages stay between their two members.
  if (route === 'Team chat') return user?.roleId !== 'super-admin';
  if (route === 'Inbox rules') return user?.roleId === 'admin';
  // Every company member may send agreements (owner decision 2026-10-20); the Super Admin
  // sees no agreement terms (agreements-design §9).
  if (route === 'Agreements') return user?.roleId !== 'super-admin';
  // The marketplace belongs to Blaqks One companies; the Super Admin reviews its applications
  // on the platform screen instead (broker-marketplace §13–§15, packet MK1).
  if (route === 'Marketplace') return user?.roleId !== 'super-admin';
  if (route === 'Marketplace applications') return user?.roleId === 'super-admin';
  // Each member's own mailbox: the Admin, and staff the Admin gave email (decision O8).
  if (route === 'My mailbox' || route === 'Google sign-in')
    return user?.roleId === 'admin' || (user?.roleId === 'staff' && user.channelAccess?.email);
  // The member's own WhatsApp number: the Admin, and staff the Admin gave WhatsApp (WQ3).
  if (route === 'My WhatsApp')
    return (
      user?.roleId === 'admin' ||
      (user?.roleId === 'staff' && user.channelAccess?.whatsapp === true)
    );
  if (['Dashboard', 'Guide', 'Calculators', 'My profile', 'Team activity'].includes(route))
    return true;
  if (route === 'Messages')
    return (
      canManageTeam(user) ||
      user.channelAccess?.email === true ||
      user.channelAccess?.whatsapp === true
    );
  const permission = routePermissions[route];
  return Boolean(permission && user.permissions?.[permission] === true);
}

/** Server-equivalent refusals (action permissions contract §4, §13.5). */
export const actionDeniedMessages = {
  create: "Your access doesn't include adding these records.",
  edit: "Your access doesn't include editing these records.",
  delete: 'Ask your Admin to delete this record.',
  assign: "Your access doesn't include handing on these records.",
};
export const followUpDeleteMessage =
  "Only the client's holder, the Admin or a full-team member can delete this follow-up.";

/** Leads are a view over Clients, so they share the Clients grants. */
export const actionCollection = (module) => (module === 'Leads' ? 'Clients' : module);

/**
 * Contract §6: reads the session's effective `recordActions`. A missing session, collection or
 * flag denies; connected mode never falls back to allowing everything.
 */
export function canAct(user, module, action) {
  const entry = user?.recordActions?.[actionCollection(module)];
  return Boolean(entry && typeof entry === 'object' && entry[action] === true);
}

/** "View only" applies when the member can neither add nor edit records in the module. */
export function isViewOnly(user, module) {
  return !canAct(user, module, 'create') && !canAct(user, module, 'edit');
}

/**
 * Why a connected delete is refused, or '' when it may proceed. A non-holding direct assignee of
 * a client-linked Follow-up may only return it, never delete it (§13.5).
 */
export function deleteRefusal(user, records, module, record) {
  if (!canAct(user, module, 'delete')) return actionDeniedMessages.delete;
  if (actionCollection(module) !== 'Follow-ups') return '';
  const entries = records?.entries || {};
  const entry = findEntry(entries, 'Follow-ups', record);
  return returnsOnly(entries, 'Follow-ups', entry, records?.scope, user?.id)
    ? followUpDeleteMessage
    : '';
}

/** Saving a new record needs Add; saving an existing one needs Edit. */
export const saveAction = (original) => (original ? 'edit' : 'create');

/** The server-equivalent message for a refused save, or '' when it may proceed. */
export function saveRefusal(user, module, original) {
  const action = saveAction(original);
  return canAct(user, module, action) ? '' : actionDeniedMessages[action];
}

/** Contract §8 IDs: blank on create (issued by the server); assigned-only staff cannot type one. */
export function serverIdPolicy(scope, original) {
  return { issued: !original, readOnly: scope !== 'team' };
}
