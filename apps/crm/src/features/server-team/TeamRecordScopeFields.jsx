import React from 'react';
import { recordScopeOptions } from './model.js';
import { normaliseActions } from './actionModel.js';

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
            onChange={() =>
              change('recordScope', value, {
                // Assigned-only visibility clears delete-main and team finance ticks (A2 §1.4, §5.1).
                actions: normaliseActions(form.actions, { ...form, recordScope: value }),
              })
            }
          />
          {label}
        </label>
      ))}
      <small>
        Whole-team access still respects the sections allowed above. Deleting clients, contacts or
        properties, seeing team finance and approving need whole-team visibility.
      </small>
    </fieldset>
  );
}
