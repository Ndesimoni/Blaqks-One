export const checklistStorageKey = (workspaceId) => `kws-crm-get-started-hidden:${workspaceId}`;

export function deriveGettingStarted(data, company) {
  const tasks = [
    { id: 'property', route: 'Properties', complete: Boolean(data.Properties?.length) },
    { id: 'client', route: 'Clients', complete: Boolean(data.Clients?.length) },
    { id: 'followUp', route: 'Follow-ups', complete: Boolean(data['Follow-ups']?.length) },
  ];
  if (!company?.setupComplete) tasks.push({ id: 'company', route: 'My profile', complete: false });
  tasks.push({ id: 'team', route: 'Team & access', complete: false });
  return tasks;
}

export function readChecklistHidden(workspaceId, storage = globalThis.localStorage) {
  try {
    return storage.getItem(checklistStorageKey(workspaceId)) === 'true';
  } catch {
    return false;
  }
}

export function hideChecklist(workspaceId, storage = globalThis.localStorage) {
  try {
    storage.setItem(checklistStorageKey(workspaceId), 'true');
  } catch {
    // A blocked preference store must not block the workspace.
  }
}
