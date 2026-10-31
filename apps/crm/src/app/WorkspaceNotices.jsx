import React from 'react';
import { Button } from '../components/ui/Button.jsx';
import { useRecords, usePreferences, useWorkspaceActions } from '../hooks/useWorkspace.js';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.js';

export function WorkspaceNotices() {
  const { storageError, retryStorage } = useRecords();
  const { preferencesError } = usePreferences();
  const { fileBusy, downloadFullBackup } = useWorkspaceActions();
  useUnsavedChanges(
    Boolean(storageError),
    fileBusy,
    'Some workspace changes are not saved. Export a full backup or retry saving before leaving. Leave anyway?',
  );
  return (
    <>
      {storageError && (
        <div className="storage-banner" role="alert">
          <strong>Changes could not be saved.</strong>
          <span>{storageError}</span>
          <Button variant="light" onClick={downloadFullBackup}>
            Export full backup
          </Button>
          <Button variant="light" onClick={retryStorage}>
            Retry saving
          </Button>
        </div>
      )}
      {preferencesError && (
        <p className="storage-banner" role="status">
          {preferencesError}
        </p>
      )}
    </>
  );
}
