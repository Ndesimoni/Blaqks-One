import React, { useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { detailsChanges, detailsError } from './profileModel.js';

const fields = [
  ['name', 'Full name', 'text', 'name'],
  ['phone', 'Phone number', 'tel', 'tel'],
];

/** Edits only the member's own name and phone; remount it (key) when the account version changes. */
export function ProfileDetailsForm({ api, account, onSaved, onReload }) {
  const { user } = account;
  const [form, setForm] = useState({ name: user.name, phone: user.phone });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputs = useRef({});
  const changes = detailsChanges(form, user);
  useUnsavedChanges(Boolean(changes), busy);
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const invalid = detailsError(form);
    setError(invalid);
    if (invalid) return inputs.current[invalid.field]?.focus();
    if (!changes) return setError({ message: 'There are no changes to save.' });
    setBusy(true);
    try {
      onSaved(await api.updateAccount({ version: account.version, ...changes }));
    } catch (failure) {
      setError({ message: failure.message, stale: failure.status === 409 });
      setBusy(false);
    }
  };
  return (
    <section className="panel profile-panel" aria-labelledby="profile-details-title">
      <h2 id="profile-details-title">Edit details</h2>
      <form className="profile-form" onSubmit={submit} noValidate>
        {fields.map(([field, label, type, autoComplete]) => {
          const invalid = error?.field === field;
          return (
            <div className="field" key={field}>
              <label htmlFor={`profile-${field}`}>{label} *</label>
              <input
                id={`profile-${field}`}
                ref={(node) => {
                  inputs.current[field] = node;
                }}
                type={type}
                autoComplete={autoComplete}
                required
                value={form[field]}
                disabled={busy}
                aria-invalid={invalid}
                aria-describedby={invalid ? `profile-${field}-error` : undefined}
                onChange={(event) => setForm({ ...form, [field]: event.target.value })}
              />
              {field === 'phone' && <small>Include the country code, such as +971.</small>}
              {invalid && (
                <p className="field-error" id={`profile-${field}-error`} role="alert">
                  {error.message}
                </p>
              )}
            </div>
          );
        })}
        <div className="profile-actions">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
        {error && !error.field && (
          <div className="profile-alert" role="alert">
            <p className="field-error">{error.message}</p>
            {error.stale && (
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
