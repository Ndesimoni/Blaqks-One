import { useState } from 'react';
import { SUPER_WORKSPACE_ID } from '../../config/workspaces.js';
import { savedImportSources, readSavedImport, readBackupImport } from './importSources.js';
import { importDestination } from './importModel.js';
import { createFullBackup } from '../../services/files/backup.js';
import { downloadJson } from '../../services/files/download.js';
import { dubaiToday } from '../../lib/dubaiDate.js';

export function useImportDraft(user) {
  const [sources] = useState(() => {
    try {
      return { items: savedImportSources(user), error: '' };
    } catch (error) {
      return { items: [], error: error.message };
    }
  });
  const [mode, setMode] = useState('browser');
  const [selectedKey, setSelectedKey] = useState('');
  const [source, setSource] = useState(null);
  const [file, setFile] = useState(null);
  const [backupOwner, setBackupOwner] = useState(SUPER_WORKSPACE_ID);
  const [destination, setDestination] = useState('');
  const [demoPhotos, setDemoPhotos] = useState(true);
  const [sourceError, setSourceError] = useState('');
  const [reading, setReading] = useState(false);
  const chooseMode = (next) => {
    setDestination('');
    setMode(next);
    setSource(null);
    setSourceError('');
    setFile(null);
    setSelectedKey('');
  };
  const chooseBrowser = (key) => {
    setDestination('');
    setSelectedKey(key);
    setSource(null);
    setSourceError('');
    if (!key) return;
    try {
      setSource(
        readSavedImport(
          user,
          sources.items.find((item) => item.key === key),
        ),
      );
    } catch (error) {
      setSourceError(error.message);
    }
  };
  const readBackup = async (selected, ownership) => {
    setSource(null);
    setSourceError('');
    if (!selected) return;
    setReading(true);
    try {
      if (selected.size > 15 * 1024 * 1024)
        throw Error('Please select a backup smaller than 15 MB.');
      setSource(readBackupImport(user, await selected.text(), ownership, selected.name));
    } catch (error) {
      setSourceError(error.message);
    } finally {
      setReading(false);
    }
  };
  const chooseFile = (selected) => {
    setDestination('');
    setFile(selected);
    readBackup(selected, backupOwner);
  };
  const chooseBackupOwner = (id) => {
    setDestination('');
    setBackupOwner(id);
    readBackup(file, id);
  };
  const targetId = importDestination(source?.sourceWorkspaceId || backupOwner, destination);
  const downloadBackup = () => {
    if (!source?.fullData) return;
    const name = source.sourceWorkspaceId.replace(/[^a-z0-9_-]/gi, '-');
    downloadJson(
      createFullBackup(source.fullData),
      `Keys_with_Simoni_${name}_Full_Backup_${dubaiToday()}.json`,
    );
  };
  return {
    sources,
    mode,
    selectedKey,
    source,
    backupOwner,
    destination,
    demoPhotos,
    sourceError,
    reading,
    targetId,
    chooseMode,
    chooseBrowser,
    chooseFile,
    chooseBackupOwner,
    setDestination,
    setDemoPhotos,
    downloadBackup,
  };
}
