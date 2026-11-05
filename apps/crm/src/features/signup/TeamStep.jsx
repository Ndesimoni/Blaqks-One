import React, { useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { SignupProgress } from './SignupProgress.jsx';
import { SignupShell } from './SignupShell.jsx';

const POINTS = ['teamPointOne', 'teamPointTwo', 'teamPointThree'];

/**
 * Sign-up's last step (owner, 2026-11-05): invite colleagues now in Team & access, where the
 * Admin chooses each person's positions and access and shares their private link, or skip.
 */
export function TeamStep({ onInvite, onSkip }) {
  const { t } = useI18n();
  const heading = useRef(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <SignupShell>
      <SignupProgress step={4} />
      <div className="signup-step">
        <h1 ref={heading} tabIndex="-1">
          {t('signup.teamTitle')}
        </h1>
        <p>{t('signup.teamBody')}</p>
        <ul className="signup-team-points">
          {POINTS.map((key) => (
            <li key={key}>{t(`signup.${key}`)}</li>
          ))}
        </ul>
        <Button className="signup-primary" onClick={onInvite}>
          {t('signup.teamInvite')}
        </Button>
        <p className="auth-alt">
          <button type="button" className="auth-link" onClick={onSkip}>
            {t('signup.teamSkip')}
          </button>
        </p>
      </div>
    </SignupShell>
  );
}
