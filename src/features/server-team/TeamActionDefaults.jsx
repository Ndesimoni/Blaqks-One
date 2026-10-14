import React, { useId } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { actionModules, positionDefaultActions } from './actionModel.js';

/** Explicit reset of record actions to the selected positions' presets (A2 §12 M-D). */
export function TeamActionDefaults({ form, change, roles, busy }) {
  const helpId = useId();
  const enabled = Object.keys(actionModules).some((module) => form.permissions[module]);
  if (!enabled) return null;
  return (
    <div className="team-action-defaults">
      <Button
        variant="light"
        disabled={busy || !form.positions.length}
        aria-describedby={helpId}
        onClick={() => change('actions', positionDefaultActions(form, roles))}
      >
        Use position defaults
      </Button>
      <small id={helpId} className="team-action-help">
        {form.positions.length
          ? 'Resets the actions above to what the selected positions allow. Deleting clients, contacts or properties stays off.'
          : 'Choose a position to use its defaults.'}
      </small>
    </div>
  );
}
