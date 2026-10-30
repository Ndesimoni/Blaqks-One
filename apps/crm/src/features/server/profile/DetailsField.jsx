import React from 'react';

/** One labelled name or phone input with its hint and inline error. */
export function DetailsField({
  field,
  label,
  type,
  autoComplete,
  hint,
  form,
  busy,
  inputs,
  error,
  onChange,
  onBlur,
}) {
  const id = `profile-${field}`;
  const described = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].join(' ').trim();
  return (
    <div className="field">
      <label htmlFor={id}>{label} *</label>
      <input
        id={id}
        ref={(node) => {
          inputs.current[field] = node;
        }}
        type={type}
        autoComplete={autoComplete}
        required
        value={form[field]}
        disabled={busy}
        aria-invalid={Boolean(error)}
        aria-describedby={described || undefined}
        onChange={(event) => onChange(field, event.target.value)}
        onBlur={onBlur}
      />
      {hint && !error && (
        <small className="acct-hint" id={`${id}-hint`}>
          {hint}
        </small>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}
