// Per-action grants for connected staff (A2 contract §3, §5, §6, §12 M-C/M-D; finance §5.1).
// The server is authoritative; these helpers mirror its save invariants in the form.
import {
  deleteMainFinanceBlocker,
  financeBlocker,
  financeKeys,
  financeLabels,
  sensitiveFinanceKeys,
} from './financeActionModel.js';

export const actionModules = {
  relationships: ['create', 'edit', 'assign', 'deleteMain'],
  properties: ['create', 'edit', 'assign', 'deleteActivity', 'deleteMain'],
  schedule: ['create', 'edit', 'assign', 'deleteActivity'],
  finance: financeKeys,
};
const commonLabels = {
  create: 'Add',
  edit: 'Edit',
  assign: 'Hand on',
  deleteActivity: 'Delete activity',
};
export const deleteMainLabels = {
  relationships: 'Delete clients & contacts',
  properties: 'Delete properties',
};
// Deleting a parent record needs view access to every module that can reference it (M-C).
const deleteMainCoverage = { relationships: ['schedule', 'properties'], properties: ['schedule'] };
const coverageText = {
  relationships: 'Needs Scheduling and Properties access',
  properties: 'Needs Scheduling access',
};

export const actionLabel = (module, key) => {
  if (module === 'finance') return financeLabels[key];
  return key === 'deleteMain' ? deleteMainLabels[module] : commonLabels[key];
};

/** Sensitive ticks are never preset, never sent with invitations and flagged in review. */
export const isSensitive = (module, key) =>
  key === 'deleteMain' || (module === 'finance' && sensitiveFinanceKeys.includes(key));

const moduleEntries = (pick) =>
  Object.fromEntries(
    Object.entries(actionModules).map(([module, keys]) => [
      module,
      Object.fromEntries(keys.map((key) => [key, pick(module, key)])),
    ]),
  );

export const emptyActions = () => moduleEntries(() => false);

/** Lenient read of stored actions: any value other than `true` is false. */
export const readActions = (actions) =>
  moduleEntries((module, key) => actions?.[module]?.[key] === true);

export const hasRecordedActions = (actions) =>
  !!actions && Object.keys(actions).some((module) => module in actionModules);

/** Why deleting main records is unavailable, or '' when the tick may be used. */
export function deleteMainBlocker(module, form) {
  if (form.recordScope !== 'team') return 'Needs whole-team visibility';
  if (!deleteMainCoverage[module].every((name) => form.permissions[name]))
    return coverageText[module];
  return deleteMainFinanceBlocker(module, form);
}

/** Why one tick is unavailable for this form, or ''. */
export function actionBlocker(module, key, form) {
  if (module === 'finance') return financeBlocker(key, form);
  return key === 'deleteMain' ? deleteMainBlocker(module, form) : '';
}

/** Save invariants: off modules have no actions; sensitive ticks need scope and their prerequisites. */
export function normaliseActions(actions, form) {
  const kept = moduleEntries(
    (module, key) => !!form.permissions[module] && actions?.[module]?.[key] === true,
  );
  const context = { ...form, actions: kept };
  return moduleEntries((module, key) => kept[module][key] && !actionBlocker(module, key, context));
}

/** Position preset for one module; positions OR together and never grant sensitive ticks. */
export function modulePreset(module, positions, roles) {
  const granting = roles.filter(
    (role) => positions.includes(role.id) && role.permissions?.[module],
  );
  return Object.fromEntries(
    actionModules[module].map((key) => {
      if (isSensitive(module, key)) return [key, false];
      // A module enabled by hand (no granting position) gets the standard preset.
      if (!granting.length) return [key, true];
      return [key, granting.some((role) => role.actions?.[module]?.[key] === true)];
    }),
  );
}

const standardPresets = () => moduleEntries((module, key) => !isSensitive(module, key));

/** Initial form actions for a member; Admin actions are never held or echoed. */
export function memberActions(member, form) {
  if (!member || member.roleId === 'admin') return emptyActions();
  if (!hasRecordedActions(member.actions)) return normaliseActions(standardPresets(), form);
  const stored = readActions(member.actions);
  // Grants recorded before finance existed take the finance preset, as the server's backfill does.
  if (!member.actions.finance) stored.finance = standardPresets().finance;
  return normaliseActions(stored, form);
}

/** Module or position change: newly enabled modules take presets; enabled ones keep theirs (M-D). */
export function actionsAfterAccessChange(form, permissions, positions, roles) {
  const next = { ...form, permissions, positions };
  const actions = Object.fromEntries(
    Object.keys(actionModules).map((module) => [
      module,
      !form.permissions[module] && permissions[module]
        ? modulePreset(module, positions, roles)
        : form.actions[module],
    ]),
  );
  return normaliseActions(actions, next);
}

/** Explicit "Use position defaults": every enabled module returns to its preset. */
export function positionDefaultActions(form, roles) {
  const presets = Object.fromEntries(
    Object.keys(actionModules).map((module) => [
      module,
      modulePreset(module, form.positions, roles),
    ]),
  );
  return normaliseActions(presets, form);
}

/** Complete staff payload, finance included; invitations omit the sensitive ticks. */
export function actionPayload(form, { invitation = false } = {}) {
  const actions = normaliseActions(form.actions, form);
  if (!invitation) return actions;
  return Object.fromEntries(
    Object.entries(actions).map(([module, flags]) => [
      module,
      Object.fromEntries(Object.entries(flags).filter(([key]) => !isSensitive(module, key))),
    ]),
  );
}
