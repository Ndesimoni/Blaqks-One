import { STORAGE } from '../../config/storage.js';
import { TEAM_STORAGE } from '../../config/team.js';
import { SUPER_WORKSPACE_ID } from '../../config/workspaces.js';
import { normalizeEnvelope } from '../../lib/validation.js';
import { parseFullBackup } from '../../services/files/backup.js';
import { prepareServerImport, requireImportOwner } from './importModel.js';

export function savedImportSources(user, getStorage = () => globalThis.localStorage) {
  requireImportOwner(user);
  const storage = getStorage();
  let names = {};
  try {
    const team = JSON.parse(storage.getItem(TEAM_STORAGE));
    names = Object.fromEntries(
      (team?.members || [])
        .filter((member) => typeof member.id === 'string' && typeof member.name === 'string')
        .map((member) => [member.id, member.name]),
    );
  } catch {
    /* Preview names are labels only; they never establish server identity. */
  }
  const sources = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key === STORAGE)
      sources.push({ key, id: SUPER_WORKSPACE_ID, label: 'Super Admin organisation workspace' });
    else if (key?.startsWith(`${STORAGE}:workspace:`)) {
      let id;
      try {
        id = decodeURIComponent(key.slice(`${STORAGE}:workspace:`.length));
      } catch {
        continue;
      }
      if (id) sources.push({ key, id, label: `${names[id] || id} · Personal browser workspace` });
    }
  }
  return sources.sort((a, b) =>
    a.id === SUPER_WORKSPACE_ID
      ? -1
      : b.id === SUPER_WORKSPACE_ID
        ? 1
        : a.label.localeCompare(b.label),
  );
}

export function readSavedImport(user, source, getStorage = () => globalThis.localStorage) {
  requireImportOwner(user);
  if (
    !source ||
    !savedImportSources(user, getStorage).some(
      (item) => item.key === source.key && item.id === source.id,
    )
  )
    throw Error('Choose an existing saved browser workspace.');
  const raw = getStorage().getItem(source.key);
  if (raw === null) throw Error('The saved browser workspace is no longer available.');
  const data = normalizeEnvelope(JSON.parse(raw)).data;
  return {
    ...prepareServerImport(data),
    fullData: data,
    sourceWorkspaceId: source.id,
    label: source.label,
  };
}

export function readBackupImport(user, raw, sourceWorkspaceId, fileName) {
  requireImportOwner(user);
  return {
    ...prepareServerImport(parseFullBackup(raw)),
    sourceWorkspaceId,
    label: `${fileName} · ${sourceWorkspaceId === SUPER_WORKSPACE_ID ? 'Organisation backup' : 'Personal backup (selected by you)'}`,
  };
}
