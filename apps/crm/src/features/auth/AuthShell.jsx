import React from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { SignupUtilities } from '../signup/SignupUtilities.jsx';
import { websiteHome } from './websiteHome.js';
import '../signup/signup.css';
import './auth-shell.css';
import './auth-card.css';

/**
 * Sign-in, sign-up and invitations as the approved website design shows them (owner,
 * 2026-11-05): the Blaqks One wordmark over one centred card, under a gold-rimmed arc, filling
 * the window in light and dark. Each screen keeps its own address (features/auth/authPaths).
 * With a website set up, a link at the top and the wordmark lead back to its home page.
 */
export function AuthShell({ children, busy = false }) {
  const { t } = useI18n();
  const home = websiteHome();
  const mark = (
    <>
      {t('auth.brand')}
      <span aria-hidden="true" />
    </>
  );
  return (
    <main className="auth-page">
      {home && (
        <a className="auth-home" href={home}>
          <span aria-hidden="true">←</span> {t('auth.backToSite')}
        </a>
      )}
      <SignupUtilities />
      {home ? (
        <a className="auth-wordmark u-ltr" href={home} aria-label={t('auth.backToSite')}>
          {mark}
        </a>
      ) : (
        <p className="auth-wordmark u-ltr">{mark}</p>
      )}
      <div className="auth-card" aria-busy={busy || undefined}>
        {children}
      </div>
    </main>
  );
}
