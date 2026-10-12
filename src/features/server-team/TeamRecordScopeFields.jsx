import React from 'react';
import { recordScopeOptions } from './model.js';

/** Staff-only, edit-only grant (contract §6 M7). Invitations and positions never set it. */
export function TeamRecordScopeFields({ form, change, busy }) {
  return (
    <fieldset className="connected-team-options">
      <legend>Record visibility</legend>
      {recordScopeOptions.map(([value, label]) => (
        <label key={value}>
          <input
            type="radio"
            name="record-scope"
            value={value}
            checked={form.recordScope === value}
            disabled={busy}
            onChange={() => change('recordScope', value)}
          />
          {label}
        </label>
      ))}
      <small>Whole-team access still respects the sections allowed above.</small>
    </fieldset>
  );
}
