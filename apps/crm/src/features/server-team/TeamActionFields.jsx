import React, { useId } from 'react';
import {
  actionBlocker,
  actionLabel,
  actionModules,
  isSensitive,
  normaliseActions,
} from './actionModel.js';
import { actionHelp, invitationNote } from './actionText.js';

/** Per-action ticks under one enabled connected module (A2 §6; finance-design §7). */
export function TeamActionFields({ module, label, form, change, busy, invitation }) {
  const baseId = useId();
  const keys = actionModules[module].filter((key) => !(invitation && isSensitive(module, key)));
  const sensitiveKeys = keys.filter((key) => isSensitive(module, key));
  const helpId = (key) => `${baseId}-${key}`;
  const note = invitation ? invitationNote(module) : '';
  // Each change is normalised, so clearing a prerequisite also clears what depends on it.
  const toggle = (key, checked) =>
    change(
      'actions',
      normaliseActions(
        { ...form.actions, [module]: { ...form.actions[module], [key]: checked } },
        form,
      ),
    );
  return (
    <fieldset className="team-action-fields">
      <legend>
        <span className="sr-only">{label}: </span>What they can do
      </legend>
      <div className="team-action-options">
        {keys.map((key) => {
          const sensitive = isSensitive(module, key);
          const blocked = sensitive && !!actionBlocker(module, key, form);
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
                aria-describedby={sensitive ? helpId(key) : undefined}
                onChange={(event) => toggle(key, event.target.checked)}
              />
              {actionLabel(module, key)}
            </label>
          );
        })}
      </div>
      {sensitiveKeys.map((key) => (
        <small key={key} id={helpId(key)} className="team-action-help">
          {sensitiveKeys.length > 1 && (
            <span className="team-action-help-label">{actionLabel(module, key)}: </span>
          )}
          {actionHelp(module, key, form)}
        </small>
      ))}
      {note && <small className="team-action-help">{note}</small>}
    </fieldset>
  );
}
