import React from 'react';
import { ImportCounts } from './ImportCounts.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ImportOriginFields } from './ImportOriginFields.jsx';

/**
 * Where the records come from, and for a personal set the active member of the Admin's own
 * company who receives them (BO1a); the organisation set goes to the Admin.
 */
export function ImportSourceFields({ draft, members, busy }) {
  const { source, mode } = draft;
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
            <label htmlFor="import-member">Give the records to</label>
            <select
              id="import-member"
              value={draft.personal ? draft.memberId : ''}
              disabled={!draft.personal}
              onChange={(event) => draft.setMemberId(event.target.value)}
            >
              {!draft.personal && <option value="">You, the company Admin</option>}
              {draft.personal &&
                members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
            <p>
              {draft.personal
                ? 'The records join your company and are held by this member.'
                : 'Organisation records join your company and are held by you.'}
            </p>
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
