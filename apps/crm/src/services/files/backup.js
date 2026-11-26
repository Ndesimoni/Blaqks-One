import { normalizeWorkspaceData } from '../../lib/validation.js';
import { MAX_MEDIA_TOTAL } from '../../config/storage.js';

export function createFullBackup(data, exportedAt = new Date().toISOString()) {
  return {
    format: 'keys-with-simoni-full-backup',
    version: 2,
    exportedAt,
    data,
    mediaIncluded: true,
  };
}

export function parseFullBackup(raw) {
  const backup = JSON.parse(raw);
  if (backup?.format !== 'keys-with-simoni-full-backup' || !Array.isArray(backup.data?.Properties))
    throw Error('This is not a Keys with Simoni full backup.');
  if (backup.version !== undefined && backup.version !== 2)
    throw Error('This backup version is not supported by this CRM.');
  const data = normalizeWorkspaceData(backup.data);
  if (JSON.stringify({ data, demo: false }).length > MAX_MEDIA_TOTAL)
    throw Error('Backup exceeds this browser edition’s storage limit.');
  return data;
}
