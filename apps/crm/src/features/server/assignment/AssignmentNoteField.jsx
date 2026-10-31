import React from 'react';
import { noteLimit } from './assignmentModel.js';

/** Optional hand-off note, shown to the new assignee in the record's history. */
export function AssignmentNoteField({ id, value, onChange, disabled }) {
  const count = value.length;
  return (
    <div className="field">
      <label htmlFor={id}>Hand-off note (optional)</label>
      <textarea
        id={id}
        rows={3}
        maxLength={noteLimit}
        value={value}
        disabled={disabled}
        aria-describedby={`${id}-count`}
        placeholder="Add context for the new assignee..."
        onChange={(event) => onChange(event.target.value)}
      />
      <small id={`${id}-count`} className="assignment-note-count">
        {count} / {noteLimit} characters
      </small>
    </div>
  );
}
