import React from 'react';

export function SignupField({ id, label, hint, error, children }) {
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  return (
    <div className="field signup-field">
      <label htmlFor={id}>{label}</label>
      {React.cloneElement(children, {
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': described || undefined,
      })}
      {hint && (
        <small id={`${id}-hint`} className="signup-hint">
          {hint}
        </small>
      )}
      {error && (
        <small id={`${id}-error`} className="field-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
