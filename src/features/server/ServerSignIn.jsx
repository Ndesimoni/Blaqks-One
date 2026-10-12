import React, { useRef, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { BrandMark } from '../../components/layout/BrandMark.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { ServerTheme } from './ServerTheme.jsx';

export function ServerSignIn({ signIn, notice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const busyRef = useRef(false);
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
    <main className="sign-in-page">
      <div className="sign-in-shell">
        <section className="sign-in-story" aria-label="Keys with Simoni">
          <div className="brand sign-in-brand">
            <BrandMark />
            <div>
              <strong>
                KEYS <i>WITH</i> SIMONI
              </strong>
              <span>REAL ESTATE STUDIO</span>
            </div>
          </div>
          <div className="sign-in-story-body">
            <span className="sign-in-eyebrow">YOUR REAL ESTATE WORKSPACE</span>
            <h2>
              Relationships first.
              <br />
              <em>Opportunity follows.</em>
            </h2>
            <p>
              Your clients, contacts and properties, saved securely to your organisation’s CRM
              server.
            </p>
          </div>
        </section>
        <section className="sign-in-panel" aria-labelledby="connected-sign-in-title">
          <ServerTheme className="sign-in-theme" />
          <div className="sign-in-form-wrap">
            <div className="sign-in-access">
              <Icon name="shield" size={16} /> CONNECTED CRM
            </div>
            <h1 id="connected-sign-in-title">Welcome back</h1>
            <p className="sign-in-subtitle">Use your organisation’s account to sign in.</p>
            {notice && (
              <p role="status" className="sign-in-subtitle">
                {notice}
              </p>
            )}
            <form className="sign-in-form" onSubmit={submit}>
              <div className="field">
                <label htmlFor="connected-email">Email address</label>
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
              <div className="field">
                <label htmlFor="connected-password">Password</label>
                <div className="sign-in-password">
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
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <Button className="sign-in-submit" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
            <p className="sign-in-subtitle">
              Contact your Super Admin if you need an account or help signing in.
            </p>
          </div>
          <footer className="sign-in-footer">
            Connected CRM · Browser demo records are kept separately.
          </footer>
        </section>
      </div>
    </main>
  );
}
