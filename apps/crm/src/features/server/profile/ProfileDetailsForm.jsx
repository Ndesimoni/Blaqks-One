import React, { useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { DetailsField } from './DetailsField.jsx';
import { detailsChanges, detailsError, detailsFieldError } from './profileModel.js';

const saved = (user) => ({ name: user.name, phone: user.phone });

/**
 * Edits only the member's own name and phone. Save and Cancel stay disabled until something
 * changes; a new account version (saved or reloaded) resets the form to the server values.
 */
export function ProfileDetailsForm({ api, account, onSaved, onReload }) {
  const { user } = account;
  const [version, setVersion] = useState(account.version);
  const [form, setForm] = useState(() => saved(user));
  const [touched, setTouched] = useState({});
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const inputs = useRef({});
  if (version !== account.version) {
    setVersion(account.version);
    setForm(saved(user));
    setTouched({});
    setBusy(false);
  }
  const changes = detailsChanges(form, user);
  useUnsavedChanges(Boolean(changes), busy);
  const edit = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError((current) => (current?.field === field || !current?.field ? null : current));
    setStatus('');
  };
  const reset = () => {
    setForm(saved(user));
    setTouched({});
    setError(null);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy || !changes) return;
    const invalid = detailsError(form);
    setError(invalid);
    if (invalid) return inputs.current[invalid.field]?.focus();
    setBusy(true);
    try {
      onSaved(await api.updateAccount({ version: account.version, ...changes }));
      setStatus('Your details were saved.');
    } catch (failure) {
      setError({ message: failure.message, stale: failure.status === 409 });
      setBusy(false);
    }
  };
  const fieldError = (field) =>
    error?.field === field ? error : touched[field] ? detailsFieldError(field, form) : null;
  const common = { form, busy, inputs, onChange: edit };
  return (
    <form className="acct-form" onSubmit={submit} noValidate>
      <div className="acct-card-body acct-form-grid">
        <DetailsField
          {...common}
          field="name"
          label="Full name"
          type="text"
          autoComplete="name"
          error={fieldError('name')}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
        />
        <DetailsField
          {...common}
          field="phone"
          label="Phone number"
          type="tel"
          autoComplete="tel"
          hint="Include the country code, such as +971."
          error={fieldError('phone')}
          onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
        />
      </div>
      {error && !error.field && (
        <div className="acct-alert" role="alert">
          <p className="field-error">{error.message}</p>
          {error.stale && (
            <Button
              variant="light"
              onClick={() => {
                setError(null);
                onReload();
              }}
            >
              Reload
            </Button>
          )}
        </div>
      )}
      <div className="acct-card-foot">
        <div className="acct-foot-status">
          <div aria-live="polite">
            {status && (
              <p className="acct-success">
                <Icon name="check" size={15} />
                {status}
              </p>
            )}
          </div>
          {!status && changes && <p className="acct-muted">You have unsaved changes.</p>}
        </div>
        <div className="acct-actions">
          <Button variant="light" disabled={busy || !changes} onClick={reset}>
            Cancel
          </Button>
          <Button
            type="submit"
            className={busy ? 'acct-loading' : ''}
            disabled={busy || !changes}
            aria-busy={busy}
          >
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}
