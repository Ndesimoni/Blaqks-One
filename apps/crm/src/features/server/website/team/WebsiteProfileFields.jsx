import React from 'react';
import './website-profile-fields.css';

// [field, label key, hint key, required, input type, autocomplete, maximum length]
const FIELDS = [
  ['name', 'field.name', '', true, 'text', 'name', 100],
  ['specialty', 'field.specialty', 'field.specialtyHint', true, 'text', 'off', 200],
  ['publicWhatsApp', 'field.whatsApp', 'field.optional', false, 'tel', 'tel', 16],
  ['publicEmail', 'field.email', 'field.optional', false, 'email', 'email', 254],
];

/**
 * The public profile inputs shared by My profile and the Admin's Edit profile dialog. Errors
 * are catalogue keys; `inputs` collects the elements so the form can focus the first invalid.
 */
export function WebsiteProfileFields(props) {
  const { idPrefix, form, errors, busy, inputs, onChange, t, locked = [], lockedHint } = props;
  return (
    <div className="wt-fields">
      {FIELDS.map(([field, label, hint, required, type, autoComplete, max]) => {
        const id = `${idPrefix}-${field}`;
        const error = errors[field];
        const fixed = locked.includes(field);
        const note = fixed ? lockedHint : hint && t(`websiteTeam.${hint}`);
        const described = [note && !error ? `${id}-hint` : '', error ? `${id}-error` : '']
          .filter(Boolean)
          .join(' ');
        return (
          <div className="field" key={field}>
            <label htmlFor={id}>
              {t(`websiteTeam.${label}`)}
              {required && (
                <span className="required" aria-hidden="true">
                  {' '}
                  *
                </span>
              )}
            </label>
            <input
              id={id}
              ref={(node) => {
                inputs.current[field] = node;
              }}
              type={type}
              autoComplete={autoComplete}
              maxLength={max}
              required={required}
              value={form[field]}
              disabled={busy}
              readOnly={fixed}
              aria-invalid={Boolean(error)}
              aria-describedby={described || undefined}
              onChange={(event) => onChange(field, event.target.value)}
            />
            {note && !error && (
              <small className="wt-hint" id={`${id}-hint`}>
                {note}
              </small>
            )}
            {error && (
              <p className="field-error" id={`${id}-error`}>
                {t(`websiteTeam.${error}`)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
