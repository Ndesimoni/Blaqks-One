import React from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { SignupUtilities } from '../signup/SignupUtilities.jsx';
import { websiteHome } from './websiteHome.js';
import '../signup/signup.css';
import './auth-shell.css';
import './auth-card.css';

/**
 * Sign-in, sign-up and invitations (owner, 2026-11-05): the Blaqks One name on the left with a
 * soft gold glow, and with a website set up a quiet way back to it just beneath; the form
 * card on the right. On phones the name sits above the form. Light and dark follow the shared
 * choice. Each screen keeps its own address (features/auth/authPaths).
 */
export function AuthShell({ children, busy = false }) {
  const { t } = useI18n();
  const home = websiteHome();
  return (
    <main className="auth-page">
      <SignupUtilities />
      <div className="auth-brand-side">
        <p className="auth-wordmark u-ltr">
          {t('auth.brand')}
          <span aria-hidden="true" />
        </p>
        {home && (
          <a className="auth-back" href={home}>
            <span aria-hidden="true">←</span> {t('auth.backToSite')}
          </a>
        )}
      </div>
      <div className="auth-form-side">
        <div className="auth-card" aria-busy={busy || undefined}>
          {children}
        </div>
      </div>
    </main>
  );
}
