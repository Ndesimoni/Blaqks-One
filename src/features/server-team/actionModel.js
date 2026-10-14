// Per-action grants for connected staff (A2 contract §3, §5, §6, §12 M-C/M-D).
// The server is authoritative; these helpers mirror its save invariants in the form.
export const actionModules = {
  relationships: ['create', 'edit', 'assign', 'deleteMain'],
  properties: ['create', 'edit', 'assign', 'deleteActivity', 'deleteMain'],
  schedule: ['create', 'edit', 'assign', 'deleteActivity'],
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

export const actionLabel = (module, key) =>
  key === 'deleteMain' ? deleteMainLabels[module] : commonLabels[key];

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
  return deleteMainCoverage[module].every((name) => form.permissions[name])
    ? ''
    : coverageText[module];
}

/** Applies the save invariants: off modules have no actions; deleteMain needs scope and coverage. */
export function normaliseActions(actions, form) {
  return moduleEntries((module, key) => {
    if (!form.permissions[module] || actions?.[module]?.[key] !== true) return false;
    return key !== 'deleteMain' || !deleteMainBlocker(module, form);
  });
}

/** Position preset for one module; positions OR together and never grant deleteMain. */
export function modulePreset(module, positions, roles) {
  const granting = roles.filter(
    (role) => positions.includes(role.id) && role.permissions?.[module],
  );
  return Object.fromEntries(
    actionModules[module].map((key) => {
      if (key === 'deleteMain') return [key, false];
      // A module enabled by hand (no granting position) gets the standard preset.
      if (!granting.length) return [key, true];
      return [key, granting.some((role) => role.actions?.[module]?.[key] === true)];
    }),
  );
}

/** Initial form actions for a member; Admin actions are never held or echoed. */
export function memberActions(member, form) {
  if (!member || member.roleId === 'admin') return emptyActions();
  if (!hasRecordedActions(member.actions)) {
    const presets = moduleEntries((module, key) => key !== 'deleteMain');
    return normaliseActions(presets, form);
  }
  return normaliseActions(readActions(member.actions), form);
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

/** Complete staff payload; invitations omit deleteMain (the server rejects it there). */
export function actionPayload(form, { invitation = false } = {}) {
  const actions = normaliseActions(form.actions, form);
  if (!invitation) return actions;
  return Object.fromEntries(
    Object.entries(actions).map(([module, flags]) => {
      const { deleteMain: _omitted, ...rest } = flags;
      return [module, rest];
    }),
  );
}
