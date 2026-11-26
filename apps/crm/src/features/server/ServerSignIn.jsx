import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { useI18n } from '../../i18n/useI18n.js';
import { AuthShell } from '../auth/AuthShell.jsx';

/**
 * Sign in, as the approved mockup's full-screen split screen (design queue item 34). Create
 * a company account shows only while public sign-up is open.
 */
export function ServerSignIn({ api, signIn, notice }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const busyRef = useRef(false);
  const [signupEnabled, setSignupEnabled] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api
      .signupStatus(controller.signal)
      .then((value) => setSignupEnabled(value.enabled))
      .catch(() => {});
    return () => controller.abort();
  }, [api]);
  useUnsavedChanges(false, busy);
  const submit = async (event) => {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await signIn(email.trim(), password);
      setPassword('');
    } catch (failure) {
      setError(failure.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <AuthShell busy={busy}>
      <h1>{t('auth.signIn.title')}</h1>
      <p>{t('auth.signIn.body')}</p>
      {notice && <p role="status">{notice}</p>}
      <form onSubmit={submit}>
        <div className="field signup-field">
          <label htmlFor="connected-email">{t('auth.signIn.email')}</label>
          <input
            id="connected-email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            required
            value={email}
            disabled={busy}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field signup-field">
          <label htmlFor="connected-password">{t('auth.signIn.password')}</label>
          <span className="signup-password">
            <input
              id="connected-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              aria-label={t(showPassword ? 'auth.signIn.hideLabel' : 'auth.signIn.showLabel')}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              {t(showPassword ? 'auth.signIn.hide' : 'auth.signIn.show')}
            </button>
          </span>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <Button className="auth-submit" type="submit" disabled={busy}>
          {t(busy ? 'auth.signIn.busy' : 'auth.signIn.submit')}
        </Button>
      </form>
      <p className="auth-alt">{t('auth.signIn.forgot')}</p>
      {signupEnabled && (
        <p className="auth-alt">
          {t('auth.signIn.new')}{' '}
          <Link className="auth-link" to="/sign-up">
            {t('auth.signIn.create')}
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
