const nameOrder = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function workspaceStatusLabel(workspace) {
  if (workspace.status === 'archived') return 'Archived · Read-only';
  if (workspace.status === 'inactive') return 'Suspended';
  return 'Active';
}

export function workspaceOpenLabel(workspace) {
  const name = String(workspace.name || '').trim();
  return /\bworkspace$/i.test(name) ? `Open ${name}` : `Open ${name} workspace`;
}

export function filterWorkspaces(workspaces, query) {
  const search = query.trim().toLocaleLowerCase();
  return workspaces
    .filter((workspace) => {
      const status = workspace.status === 'archived' ? 'archived deleted read-only' : 'current';
      const searchable = `${workspace.name} ${status} ${workspaceStatusLabel(workspace)} ${workspace.status}`;
      return searchable.toLocaleLowerCase().includes(search);
    })
    .sort((a, b) => nameOrder.compare(a.name, b.name) || String(a.id).localeCompare(String(b.id)));
}
