import { routePermissions } from '../../config/team.js';
import { findEntry, returnsOnly } from './assignment/assignmentModel.js';

export function canManageTeam(user) {
  return user?.roleId === 'admin' || user?.roleId === 'super-admin';
}

export function canOpenSection(user, route) {
  if (!['admin', 'super-admin', 'staff'].includes(user?.roleId)) return false;
  if (['Team & access', 'Team activity', 'Workspaces'].includes(route)) return canManageTeam(user);
  if (['Dashboard', 'Guide', 'My profile'].includes(route)) return true;
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
