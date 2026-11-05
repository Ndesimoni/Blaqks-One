import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';

/**
 * A password input with its own show/hide toggle. The toggle's name says what it will do
 * ("Show new password"); the value stays in the parent's local state only.
 */
export function PasswordField({
  id,
  label,
  autoComplete,
  value,
  visible,
  disabled,
  error,
  describedBy,
  inputRef,
  onChange,
  onToggle,
  children,
}) {
  const described = [describedBy, error ? `${id}-error` : ''].join(' ').trim();
  const action = `${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="acct-password">
        <input
          id={id}
          ref={inputRef}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={described || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="acct-reveal"
          aria-label={action}
          title={action}
          aria-controls={id}
          disabled={disabled}
          onClick={onToggle}
        >
          <Icon name={visible ? 'eye-off' : 'eye'} size={18} />
        </button>
      </div>
      {children}
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}
