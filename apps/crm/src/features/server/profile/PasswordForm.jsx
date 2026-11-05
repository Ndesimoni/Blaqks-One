import React, { useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { PasswordField } from './PasswordField.jsx';
import { PasswordRules } from './PasswordRules.jsx';
import { PasswordStrength } from './PasswordStrength.jsx';
import { usePasswordChange } from './usePasswordChange.js';

const fields = [
  ['current', 'Current password', 'current-password'],
  ['next', 'New password', 'new-password'],
  ['confirm', 'Confirm new password', 'new-password'],
];

function MatchHint({ id, values }) {
  if (!values.confirm) return null;
  const match = values.confirm === values.next;
  return (
    <p id={id} className={`acct-match${match ? ' is-match' : ''}`}>
      <Icon name={match ? 'check' : 'close'} size={14} strokeWidth={2.4} />
      {match ? 'Passwords match.' : 'Passwords do not match yet.'}
    </p>
  );
}

export function PasswordForm({ api, email, onChanged, onReload }) {
  const form = usePasswordChange(api, email, onChanged);
  const [visible, setVisible] = useState({});
  const inputs = useRef({});
  useUnsavedChanges(form.dirty, form.busy);
  const submit = async (event) => {
    setVisible({});
    const field = await form.submit(event);
    if (field) inputs.current[field]?.focus();
  };
  const { outcome, values } = form;
  const context = { current: values.current, email };
  const extras = {
    next: {
      describedBy: 'profile-password-strength profile-password-rules',
      children: (
        <>
          <PasswordStrength id="profile-password-strength" password={values.next} {...context} />
          <PasswordRules id="profile-password-rules" password={values.next} {...context} />
        </>
      ),
    },
    confirm: {
      describedBy: values.confirm ? 'profile-password-match' : '',
      children: form.error?.field !== 'confirm' && (
        <MatchHint id="profile-password-match" values={values} />
      ),
    },
  };
  return (
    <form className="acct-form" onSubmit={submit} noValidate>
      <div className="acct-card-body acct-password-fields">
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        {fields.map(([field, label, autoComplete]) => (
          <PasswordField
            key={field}
            id={`profile-password-${field}`}
            label={label}
            autoComplete={autoComplete}
            value={values[field]}
            visible={Boolean(visible[field])}
            disabled={form.busy}
            error={form.error?.field === field ? form.error : null}
            inputRef={(node) => {
              inputs.current[field] = node;
            }}
            onChange={(value) => form.set(field, value)}
            onToggle={() => setVisible((current) => ({ ...current, [field]: !current[field] }))}
            {...extras[field]}
          />
        ))}
        <div aria-live="polite" className="acct-status">
          {outcome?.kind === 'success' && (
            <p className="acct-success">
              <Icon name="check" size={15} />
              {outcome.message}
            </p>
          )}
        </div>
        {outcome && outcome.kind !== 'success' && (
          <div className="acct-alert" role="alert">
            <p className="field-error">{outcome.message}</p>
            {outcome.kind === 'stale' && (
              <Button variant="light" onClick={onReload}>
                Reload
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="acct-card-foot">
        <p className="acct-muted acct-foot-status">
          <Icon name="shield" size={15} />
          Changing your password signs out every other device.
        </p>
        <div className="acct-actions">
          <Button
            type="submit"
            className={form.busy ? 'acct-loading' : ''}
            disabled={form.busy}
            aria-busy={form.busy}
          >
            {form.busy ? 'Changing password…' : 'Change password'}
          </Button>
        </div>
      </div>
    </form>
  );
}
