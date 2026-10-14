import React, { useId } from 'react';

/** One labelled control with its hint and error, linked for assistive technology. */
export function FinanceField({ name, label, required, hint, error, wide, children }) {
  const id = useId();
  const described = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean);
  return (
    <div className={'field' + (wide ? ' span-all' : '')}>
      <label htmlFor={id}>
        {label}
        {required && <span className="required"> *</span>}
      </label>
      {children({
        id,
        name,
        'aria-invalid': Boolean(error),
        'aria-describedby': described.join(' ') || undefined,
      })}
      {hint && (
        <small id={`${id}-hint`} className="finance-hint">
          {hint}
        </small>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
