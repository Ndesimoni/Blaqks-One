import { MAX_ACTIVITY_ENTRIES } from '../../config/workspaces.js';

export const activityActions = {
  create: 'Created record',
  update: 'Updated record',
  delete: 'Deleted record',
  import: 'Imported workbook',
  restore: 'Restored backup',
  clear: 'Cleared workspace',
  sample: 'Loaded sample records',
  'message-preview': 'Reviewed message preview',
};

export function normalizeActivity(entries) {
  if (!Array.isArray(entries) || entries.length > MAX_ACTIVITY_ENTRIES)
    throw Error('The saved activity history is invalid.');
  const ids = new Set();
  for (const entry of entries) {
    if (
      !entry ||
      !activityActions[entry.action] ||
      !['id', 'actorId', 'actorName', 'workspaceId', 'module', 'recordId', 'label', 'at'].every(
        (key) => typeof entry[key] === 'string',
      ) ||
      !entry.id ||
      ids.has(entry.id) ||
      !Number.isFinite(Date.parse(entry.at)) ||
      (entry.fields !== undefined &&
        (!Array.isArray(entry.fields) || entry.fields.some((field) => typeof field !== 'string')))
    )
      throw Error('The saved activity history is invalid.');
    ids.add(entry.id);
  }
  return entries;
}

/** Activity is saved atomically with the affected workspace, without field values or message text. */
export function appendActivity(
  workspace,
  user,
  workspaceId,
  event,
  { now = Date.now(), id = globalThis.crypto.randomUUID() } = {},
) {
  const entry = {
    id,
    actorId: user.id,
    actorName: user.name,
    workspaceId,
    action: event.action,
    module: event.module || 'Workspace',
    recordId: String(event.recordId || ''),
    label: String(event.label || '').slice(0, 250),
    at: new Date(now).toISOString(),
    ...(event.fields ? { fields: event.fields } : {}),
  };
  normalizeActivity([entry]);
  return {
    ...workspace,
    activity: [entry, ...(workspace.activity || [])].slice(0, MAX_ACTIVITY_ENTRIES),
  };
}

export function selectActivity(
  snapshots,
  { actor = '', workspace = '', action = '', module = '', query = '', from = '', to = '' } = {},
) {
  const search = query.trim().toLowerCase();
  return snapshots
    .flatMap(({ owner, workspace: envelope }) =>
      (envelope?.activity || [])
        .filter((entry) => entry.workspaceId === owner.id)
        .map((entry) => ({ ...entry, workspaceName: owner.name })),
    )
    .filter((entry) => {
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(
        new Date(entry.at),
      );
      return (
        (!actor || entry.actorId === actor) &&
        (!workspace || entry.workspaceId === workspace) &&
        (!action || entry.action === action) &&
        (!module || entry.module === module) &&
        (!from || day >= from) &&
        (!to || day <= to) &&
        (!search ||
          `${entry.actorName} ${entry.workspaceName} ${entry.module} ${entry.recordId} ${entry.label} ${activityActions[entry.action]} ${(entry.fields || []).join(' ')}`
            .toLowerCase()
            .includes(search))
      );
    })
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}
