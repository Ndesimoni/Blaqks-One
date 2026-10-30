import React from 'react';
import { useI18n } from '../../i18n/useI18n.js';

const TITLES = ['stepOne', 'stepTwo', 'stepThree'];

export function SignupProgress({ step }) {
  const { t } = useI18n();
  const label = t('signup.stepProgress', { step, title: t(`signup.${TITLES[step - 1]}`) });
  return (
    <div className="signup-progress">
      <p aria-live="polite">{label}</p>
      <div className="signup-progress-bars" aria-hidden="true">
        {TITLES.map((title, index) => (
          <span key={title} className={index < step ? 'active' : ''} />
        ))}
      </div>
    </div>
  );
}
