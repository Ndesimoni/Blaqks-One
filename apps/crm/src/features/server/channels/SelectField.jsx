import React from 'react';

/**
 * A required select with persistent label, helper text and an error tied to it, in the
 * shared dialog field style. `options` are `{ value, label }`; the first is the prompt.
 */
export function SelectField({
  id,
  label,
  hint,
  error,
  value,
  prompt,
  options,
  selectRef,
  onChange,
}) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        <span className="required" aria-hidden="true">
          {' '}
          *
        </span>
      </label>
      <select
        id={id}
        ref={selectRef}
        value={value}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{prompt}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <small id={`${id}-hint`} className="whatsapp-hint">
          {hint}
        </small>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error whatsapp-field-error">
          {error}
        </p>
      )}
    </div>
  );
}
