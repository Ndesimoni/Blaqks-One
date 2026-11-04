import React from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { SignupUtilities } from '../signup/SignupUtilities.jsx';
import '../signup/signup.css';
import './auth-shell.css';
import './auth-card.css';

/**
 * Sign-in, sign-up and invitations as the approved website design shows them (owner,
 * 2026-11-05): the Blaqks One wordmark over one centred card, under a gold-rimmed arc, filling
 * the window in light and dark. Each screen keeps its own address (features/auth/authPaths).
 */
export function AuthShell({ children, busy = false }) {
  const { t } = useI18n();
  return (
    <main className="auth-page">
      <SignupUtilities />
      <p className="auth-wordmark u-ltr">
        {t('auth.brand')}
        <span aria-hidden="true" />
      </p>
      <div className="auth-card" aria-busy={busy || undefined}>
        {children}
      </div>
    </main>
  );
}
