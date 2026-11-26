import React from 'react';

/** One labelled form control with optional helper text and error, shared by the channel forms. */
export function ChannelField({ id, label, hint, error, children, suffix, preview }) {
  return (
    <div className="channel-field">
      <label htmlFor={id}>{label}</label>
      {suffix ? (
        <div className="channel-suffixed">
          {children}
          <span className="u-ltr" aria-hidden="true">
            {suffix}
          </span>
        </div>
      ) : (
        children
      )}
      {preview && (
        <small className="address-preview" aria-live="polite">
          {preview}
        </small>
      )}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <p id={`${id}-error`} className="field-error channel-field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Input props that tie a control to its helper text and, when invalid, its error. */
export const described = (id, hint, error) => {
  const ids = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return {
    ...(ids ? { 'aria-describedby': ids } : {}),
    ...(error ? { 'aria-invalid': true } : {}),
  };
};
