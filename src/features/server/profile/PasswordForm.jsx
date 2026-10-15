import React, { useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { PasswordRules } from './PasswordRules.jsx';
import { usePasswordChange } from './usePasswordChange.js';

const fields = [
  ['current', 'Current password', 'current-password'],
  ['next', 'New password', 'new-password'],
  ['confirm', 'Confirm new password', 'new-password'],
];

export function PasswordForm({ api, email, onChanged, onReload }) {
  const form = usePasswordChange(api, email, onChanged);
  const [visible, setVisible] = useState(false);
  const inputs = useRef({});
  useUnsavedChanges(form.dirty, form.busy);
  const submit = async (event) => {
    const field = await form.submit(event);
    if (field) inputs.current[field]?.focus();
  };
  const { outcome } = form;
  return (
    <section className="panel profile-panel" aria-labelledby="profile-password-title">
      <h2 id="profile-password-title">Change password</h2>
      <p className="profile-note">Changing your password signs out every other device.</p>
      <form className="profile-form" onSubmit={submit} noValidate>
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        {fields.map(([field, label, autoComplete]) => {
          const id = `profile-password-${field}`;
          const invalid = form.error?.field === field;
          const described = [
            field === 'next' ? 'profile-password-rules' : '',
            invalid ? `${id}-error` : '',
          ].join(' ');
          return (
            <div className="field" key={field}>
              <label htmlFor={id}>{label}</label>
              <input
                id={id}
                ref={(node) => {
                  inputs.current[field] = node;
                }}
                type={visible ? 'text' : 'password'}
                autoComplete={autoComplete}
                value={form.values[field]}
                disabled={form.busy}
                aria-invalid={invalid}
                aria-describedby={described.trim() || undefined}
                onChange={(event) => form.set(field, event.target.value)}
              />
              {field === 'next' && (
                <PasswordRules
                  id="profile-password-rules"
                  password={form.values.next}
                  current={form.values.current}
                  email={email}
                />
              )}
              {invalid && (
                <p className="field-error" id={`${id}-error`} role="alert">
                  {form.error.message}
                </p>
              )}
            </div>
          );
        })}
        <div className="profile-actions">
          <Button
            variant="light"
            aria-pressed={visible}
            disabled={form.busy}
            onClick={() => setVisible((value) => !value)}
          >
            {visible ? 'Hide passwords' : 'Show passwords'}
          </Button>
          <Button type="submit" disabled={form.busy}>
            {form.busy ? 'Changing password…' : 'Change password'}
          </Button>
        </div>
        <div aria-live="polite" className="profile-status">
          {outcome?.kind === 'success' && <p className="profile-success">{outcome.message}</p>}
        </div>
        {outcome && outcome.kind !== 'success' && (
          <div className="profile-alert" role="alert">
            <p className="field-error">{outcome.message}</p>
            {outcome.kind === 'stale' && (
              <Button variant="light" onClick={onReload}>
                Reload
              </Button>
            )}
          </div>
        )}
      </form>
    </section>
  );
}
