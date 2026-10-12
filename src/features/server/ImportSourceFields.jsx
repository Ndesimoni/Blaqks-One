import React from 'react';
import { SUPER_WORKSPACE_ID } from '../../config/workspaces.js';
import { ImportCounts } from './ImportCounts.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ImportOriginFields } from './ImportOriginFields.jsx';

export function ImportSourceFields({ draft, workspaces, busy }) {
  const { source, mode, targetId } = draft;
  const organisation =
    source?.sourceWorkspaceId === SUPER_WORKSPACE_ID ||
    (mode === 'backup' && draft.backupOwner === SUPER_WORKSPACE_ID);
  const destinations = workspaces.filter(({ id }) =>
    organisation ? id === SUPER_WORKSPACE_ID : id !== SUPER_WORKSPACE_ID,
  );
  return (
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="tabs" role="group" aria-label="Import source type">
        <button
          type="button"
          className={mode === 'browser' ? 'active' : ''}
          aria-pressed={mode === 'browser'}
          onClick={() => draft.chooseMode('browser')}
        >
          Saved browser workspace
        </button>
        <button
          type="button"
          className={mode === 'backup' ? 'active' : ''}
          aria-pressed={mode === 'backup'}
          onClick={() => draft.chooseMode('backup')}
        >
          Full JSON backup
        </button>
      </div>
      <div className="form-section">
        <div className="form-grid">
          <ImportOriginFields draft={draft} />
          <div className="field span-all">
            <label htmlFor="import-target">Destination workspace</label>
            <select
              id="import-target"
              value={targetId}
              disabled={
                organisation || (mode === 'backup' && draft.backupOwner === SUPER_WORKSPACE_ID)
              }
              onChange={(event) => draft.setDestination(event.target.value)}
            >
              <option value="">Choose destination workspace</option>
              {destinations.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            {organisation && (
              <p>Organisation records stay in the Super Admin’s organisation workspace.</p>
            )}
          </div>
          <div className="field span-all">
            <label className="import-photo-choice">
              <input
                type="checkbox"
                checked={draft.demoPhotos}
                onChange={(event) => draft.setDemoPhotos(event.target.checked)}
              />{' '}
              Add demo photos where a property has no uploaded photos
            </label>
            <p>
              Existing uploaded photos and floor plans are preserved. Added photos are sample
              illustrations.
            </p>
          </div>
        </div>
      </div>
      {draft.sourceError && (
        <p className="field-error" role="alert">
          {draft.sourceError}
        </p>
      )}
      {source && (
        <>
          <p className="form-intro">Source: {source.label}</p>
          {mode === 'browser' && (
            <Button variant="light" icon="download" onClick={draft.downloadBackup}>
              Download source backup
            </Button>
          )}
          <ImportCounts counts={source.counts} deferred={source.deferred} />
        </>
      )}
    </fieldset>
  );
}
