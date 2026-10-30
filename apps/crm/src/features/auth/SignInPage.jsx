import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandMark } from '../../components/layout/BrandMark.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { demoAdmins, DEMO_PASSWORD } from '../../config/demoAccounts.js';
import { useSession } from '../../hooks/useSession.js';
import { useWorkspacePreferences } from '../../hooks/useWorkspacePreferences.js';
import { validateSignIn } from '../../services/auth/demoAuth.js';
import { useTeam } from '../../hooks/useTeam.js';
import { previewLink } from '../team/model.js';

export function SignInPage() {
  const { team } = useTeam();
  const { signIn } = useSession();
  const navigate = useNavigate();
  const { settings, setSettings, preferencesError } = useWorkspacePreferences();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [signInError, setSignInError] = useState('');
  const headingRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    document.title = 'Sign in · Keys with Simoni';
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const submit = (event) => {
    event.preventDefault();
    const validation = validateSignIn(email, password);
    setErrors(validation);
    setSignInError('');
    if (validation.email || validation.password) {
      (validation.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    try {
      signIn(email, password);
      setPassword('');
      navigate('/', { replace: true });
    } catch (failure) {
      setSignInError(failure.message);
      passwordRef.current?.focus();
    }
  };

  return (
    <main className="sign-in-page">
      <div className="sign-in-shell">
        <section className="sign-in-story" aria-label="Keys with Simoni workspace">
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
              A focused space for the people, properties and plans that move your business forward.
            </p>
            <ul className="sign-in-highlights">
              <li>
                <Icon name="users" size={19} />
                <div>
                  <strong>Stay close to your clients</strong>
                  <small>Leads, contacts and conversations in one place.</small>
                </div>
              </li>
              <li>
                <Icon name="home" size={19} />
                <div>
                  <strong>Find the right property</strong>
                  <small>Keep your portfolio and client requirements connected.</small>
                </div>
              </li>
              <li>
                <Icon name="calendar" size={19} />
                <div>
                  <strong>Make every follow-up count</strong>
                  <small>Plan viewings, calls and meetings with confidence.</small>
                </div>
              </li>
            </ul>
          </div>
          <div className="sign-in-story-footer">
            <span className="sign-in-dot" /> BUILT FOR AIDAH & SIMONI
          </div>
        </section>
        <section className="sign-in-panel" aria-labelledby="sign-in-title">
          <button
            className="theme-switch sign-in-theme"
            type="button"
            aria-label={settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() =>
              setSettings((previous) => ({
                ...previous,
                theme: previous.theme === 'dark' ? 'light' : 'dark',
              }))
            }
          >
            <Icon name={settings.theme === 'dark' ? 'sun' : 'moon'} size={18} />
            <span>{settings.theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <div className="sign-in-form-wrap">
            <div className="sign-in-access">
              <Icon name="shield" size={16} /> ADMIN WORKSPACE
            </div>
            <h1 id="sign-in-title" tabIndex={-1} ref={headingRef}>
              Welcome back
            </h1>
            <p className="sign-in-subtitle">Sign in to your Keys with Simoni workspace.</p>
            <form className="sign-in-form" noValidate onSubmit={submit}>
              <div className="field">
                <label htmlFor="sign-in-email">Email address</label>
                <input
                  id="sign-in-email"
                  ref={emailRef}
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  placeholder="you@example.com"
                  value={email}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'sign-in-email-error' : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setErrors((previous) => ({ ...previous, email: '' }));
                    setSignInError('');
                  }}
                />
                {errors.email && (
                  <p className="field-error" id="sign-in-email-error">
                    {errors.email}
                  </p>
                )}
              </div>
              <div className="field">
                <label htmlFor="sign-in-password">Password</label>
                <div className="sign-in-password">
                  <input
                    id="sign-in-password"
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
                    value={password}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'sign-in-password-error' : undefined}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setErrors((previous) => ({ ...previous, password: '' }));
                      setSignInError('');
                    }}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-controls="sign-in-password"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((previous) => !previous)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.password && (
                  <p className="field-error" id="sign-in-password-error">
                    {errors.password}
                  </p>
                )}
              </div>
              {signInError && (
                <p className="field-error sign-in-error" role="alert">
                  {signInError}
                </p>
              )}
              <Button type="submit" icon="arrow" className="sign-in-submit">
                Sign in
              </Button>
            </form>
            <div className="sign-in-demo" aria-label="Demo sign-in details">
              <strong>Frontend preview · Demo accounts</strong>
              <p>
                {team.configured
                  ? 'All preview accounts use this public password. Your assigned role controls your CRM access.'
                  : 'Use these sample details to explore the CRM. Both admins have full access.'}
              </p>
              {demoAdmins
                .map((sample) => team.members.find((member) => member.id === sample.id) || sample)
                .map((admin) => (
                  <div className="sign-in-demo-account" key={admin.id}>
                    <span>{admin.name}</span>
                    <code>{admin.email}</code>
                  </div>
                ))}
              <div className="sign-in-demo-password">
                <span>Demo password</span>
                <code>{DEMO_PASSWORD}</code>
              </div>
              <small>
                Demo sign-in only. Real account verification will be added with the backend.
              </small>
            </div>
            {!team.configured && (
              <Link className="team-sign-in-link" to="/setup-preview">
                Preview Super Admin setup
              </Link>
            )}
            {team.members.find(
              (member) =>
                member.email === email.trim().toLowerCase() && member.status === 'invited',
            ) && (
              <Link
                className="team-sign-in-link"
                to={previewLink(
                  'invite',
                  team.members.find((member) => member.email === email.trim().toLowerCase()),
                )}
              >
                Open my invitation preview
              </Link>
            )}
            {preferencesError && (
              <p className="field-error" role="status">
                {preferencesError}
              </p>
            )}
          </div>
          <footer className="sign-in-footer">© {new Date().getFullYear()} Keys with Simoni</footer>
        </section>
      </div>
    </main>
  );
}
