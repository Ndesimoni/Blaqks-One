import React, { useId } from 'react';
import { actionLabel, actionModules, deleteMainBlocker } from './actionModel.js';

/** Per-action ticks under one enabled connected module (A2 §6). */
export function TeamActionFields({ module, label, form, change, busy, invitation }) {
  const helpId = useId();
  const keys = actionModules[module].filter((key) => !(invitation && key === 'deleteMain'));
  const blocker = actionModules[module].includes('deleteMain')
    ? deleteMainBlocker(module, form)
    : '';
  const toggle = (key, checked) =>
    change('actions', {
      ...form.actions,
      [module]: { ...form.actions[module], [key]: checked },
    });
  return (
    <fieldset className="team-action-fields">
      <legend>
        <span className="sr-only">{label}: </span>What they can do
      </legend>
      <div className="team-action-options">
        {keys.map((key) => {
          const sensitive = key === 'deleteMain';
          const blocked = sensitive && !!blocker;
          return (
            <label
              key={key}
              className={sensitive ? 'team-action-sensitive' : undefined}
              data-disabled={blocked || undefined}
            >
              <input
                type="checkbox"
                checked={form.actions[module][key] && !blocked}
                disabled={busy || blocked}
                aria-describedby={sensitive ? helpId : undefined}
                onChange={(event) => toggle(key, event.target.checked)}
              />
              {actionLabel(module, key)}
            </label>
          );
        })}
      </div>
      {keys.includes('deleteMain') && (
        <small id={helpId} className="team-action-help">
          {blocker || 'Sensitive: removes records for the whole team. Off by default.'}
        </small>
      )}
      {invitation && actionModules[module].includes('deleteMain') && (
        <small className="team-action-help">
          Deleting {module === 'properties' ? 'properties' : 'clients and contacts'} can be granted
          later, with whole-team visibility.
        </small>
      )}
    </fieldset>
  );
}
