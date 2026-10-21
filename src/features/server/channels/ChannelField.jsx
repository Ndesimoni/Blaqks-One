import React from 'react';

/** One labelled form control with optional helper text, shared by the channel forms. */
export function ChannelField({ id, label, hint, children, suffix, preview }) {
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
    </div>
  );
}

/** Text input props that keep an input tied to its helper text. */
export const described = (id, hint) => (hint ? { 'aria-describedby': `${id}-hint` } : {});
