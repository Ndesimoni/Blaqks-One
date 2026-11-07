import React, { useRef, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { useI18n } from '../../i18n/useI18n.js';
import { meetsPasswordPolicy, weakPasswordMessage } from '../../lib/passwordPolicy.js';
import { formatStamp } from '../server/profile/profileModel.js';
import { PasswordRules } from '../server/profile/PasswordRules.jsx';

/**
 * The invitation's form as in the approved mockup: the name and email the Admin entered,
 * shown read-only, then the password with its rules. Ours keeps the confirmation field,
 * the mobile number and when the link expires.
 */
export function InvitationPasswordForm({ invitation, onAccept, onComplete }) {
  const { t } = useI18n();
  const { email } = invitation;
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
    if (!meetsPasswordPolicy(password, { email })) return setError(weakPasswordMessage);
    if (password !== confirmation) return setError(t('auth.invite.mismatch'));
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const session = await onAccept(password);
      setPassword('');
      setConfirmation('');
      onComplete(session);
    } catch (failure) {
      setError(failure.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const field = (id, label, value) => (
    <div className="field signup-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value} readOnly />
    </div>
  );
  return (
    <form onSubmit={submit}>
      {field('activation-name', t('auth.invite.name'), invitation.name)}
      {field('activation-email', t('auth.invite.email'), email)}
      <p className="signup-hint">
        {t('auth.invite.facts', {
          phone: invitation.phone,
          expires: formatStamp(invitation.expiresAt),
        })}
      </p>
      <div className="field signup-field">
        <label htmlFor="activation-password">{t('auth.invite.password')}</label>
        <span className="signup-password">
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
          <button
            type="button"
            disabled={busy}
            aria-label={t(visible ? 'auth.signIn.hideLabel' : 'auth.signIn.showLabel')}
            aria-pressed={visible}
            onClick={() => setVisible((value) => !value)}
          >
            {t(visible ? 'auth.signIn.hide' : 'auth.signIn.show')}
          </button>
        </span>
      </div>
      <PasswordRules id="activation-password-rules" password={password} email={email} />
      <div className="field signup-field">
        <label htmlFor="activation-confirm">{t('auth.invite.confirm')}</label>
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
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <Button className="auth-submit" type="submit" disabled={busy}>
        {t(busy ? 'auth.invite.busy' : 'auth.invite.submit')}
      </Button>
    </form>
  );
}
