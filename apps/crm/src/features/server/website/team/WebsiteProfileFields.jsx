import React from 'react';
import { Icon } from '../../../../components/ui/Icon.jsx';
import './website-profile-fields.css';

// [field, label key, hint key, required, input type, autocomplete, maximum length]
const FIELDS = [
  ['name', 'field.name', '', true, 'text', 'name', 100],
  ['specialty', 'field.specialty', 'field.specialtyHint', true, 'text', 'off', 200],
  ['publicWhatsApp', 'field.whatsApp', 'field.optional', false, 'tel', 'tel', 16],
  ['publicEmail', 'field.email', 'field.optional', false, 'email', 'email', 254],
];

/** Saved values someone else may not change: plain text, then one note for the group. */
function LockedFields({ fields, form, extra, note, t }) {
  return (
    <div className="wt-locked">
      <dl className="wt-locked-list">
        {fields.map(([field, label]) => (
          <div key={field}>
            <dt>{t(`websiteTeam.${label}`)}</dt>
            <dd className={form[field] ? '' : 'is-empty'}>
              {form[field] || t('websiteTeam.field.notShown')}
            </dd>
          </div>
        ))}
      </dl>
      {extra}
      {note && (
        <p className="wt-hint wt-locked-note">
          <Icon name="lock" size={14} />
          {note}
        </p>
      )}
    </div>
  );
}

/**
 * The public profile inputs shared by My profile and the Admin's Edit profile dialog. Errors
 * are catalogue keys; `inputs` collects the elements so the form can focus the first invalid.
 * `locked` fields show their saved value as text, then `lockedExtra` (such as read-only social
 * links), then the single `lockedHint`.
 */
export function WebsiteProfileFields(props) {
  const { idPrefix, form, errors, busy, inputs, onChange, t, locked = [], lockedHint } = props;
  const fixed = FIELDS.filter(([field]) => locked.includes(field));
  return (
    <div className="wt-fields">
      {FIELDS.filter(([field]) => !locked.includes(field)).map(
        ([field, label, hint, required, type, autoComplete, max]) => {
          const id = `${idPrefix}-${field}`;
          const error = errors[field];
          const note = hint && t(`websiteTeam.${hint}`);
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
        },
      )}
      {fixed.length > 0 && (
        <LockedFields
          fields={fixed}
          form={form}
          extra={props.lockedExtra}
          note={lockedHint}
          t={t}
        />
      )}
    </div>
  );
}
