import React from 'react';
import { SUPER_WORKSPACE_ID } from '../../config/workspaces.js';

export function ImportOriginFields({ draft }) {
  const { mode } = draft;
  return (
    <>
      {mode === 'browser' ? (
        <div className="field span-all">
          <label htmlFor="import-browser-source">Saved browser workspace</label>
          <select
            id="import-browser-source"
            value={draft.selectedKey}
            onChange={(event) => draft.chooseBrowser(event.target.value)}
          >
            <option value="">Choose a saved workspace</option>
            {draft.sources.items.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          {!draft.sources.items.length && (
            <p>No saved browser workspaces were found. Select a full JSON backup instead.</p>
          )}
          {draft.sources.error && (
            <p className="field-error" role="alert">
              {draft.sources.error}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="field span-all">
            <label htmlFor="import-backup-file">Full JSON backup</label>
            <input
              id="import-backup-file"
              type="file"
              accept=".json,application/json"
              onChange={(event) => draft.chooseFile(event.target.files?.[0] || null)}
            />
          </div>
          <div className="field span-all">
            <label htmlFor="import-backup-owner">Original ownership</label>
            <select
              id="import-backup-owner"
              value={draft.backupOwner}
              onChange={(event) => draft.chooseBackupOwner(event.target.value)}
            >
              <option value={SUPER_WORKSPACE_ID}>Super Admin organisation workspace</option>
              <option value="backup-personal">Personal member workspace</option>
            </select>
            <p>
              Backup files do not include an owner. Confirm the original ownership before importing.
            </p>
          </div>
        </>
      )}
    </>
  );
}
