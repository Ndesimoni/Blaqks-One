import React, { useRef, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { meetsPasswordPolicy, weakPasswordMessage } from '../../lib/passwordPolicy.js';
import { PasswordRules } from '../server/profile/PasswordRules.jsx';

export function InvitationPasswordForm({ email, onAccept, onComplete }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const pending = useRef(false);
  useUnsavedChanges(!!password || !!confirmation, busy);
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    if (!meetsPasswordPolicy(password, { email })) {
      setError(weakPasswordMessage);
      return;
    }
    if (password !== confirmation) {
      setError('Enter the same password twice.');
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await onAccept(password);
      setPassword('');
      setConfirmation('');
      onComplete();
    } catch (failure) {
      setError(failure.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <form className="sign-in-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="activation-password">Choose password *</label>
        <input
          id="activation-password"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          minLength={8}
          required
          disabled={busy}
          value={password}
          aria-describedby="activation-password-rules"
          onChange={(event) => setPassword(event.target.value)}
        />
        <PasswordRules id="activation-password-rules" password={password} email={email} />
      </div>
      <div className="field">
        <label htmlFor="activation-confirm">Confirm password *</label>
        <input
          id="activation-confirm"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          minLength={8}
          required
          disabled={busy}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>
      <Button
        variant="light"
        aria-pressed={visible}
        disabled={busy}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? 'Hide passwords' : 'Show passwords'}
      </Button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Activating…' : 'Activate account'}
      </Button>
    </form>
  );
}
