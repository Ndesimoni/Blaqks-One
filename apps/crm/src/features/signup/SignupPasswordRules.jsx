import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { translatedPasswordRules } from './signupModel.js';
import '../server/profile/password-rules.css';

const LABELS = {
  length: 'passwordLength',
  upper: 'passwordUpper',
  lower: 'passwordLower',
  number: 'passwordNumber',
  special: 'passwordSpecial',
  email: 'passwordEmail',
  bytes: 'passwordBytes',
};

export function SignupPasswordRules({ id, password, email }) {
  const { t } = useI18n();
  return (
    <ul
      id={id}
      className={`password-rules${password ? '' : ' pending'}`}
      aria-label={t('signup.passwordRequirements')}
    >
      {translatedPasswordRules(password, email).map((rule) => (
        <li key={rule.id} className={rule.met ? 'met' : ''}>
          <span className="password-rule-icon" aria-hidden="true">
            {password && <Icon name={rule.met ? 'check' : 'close'} size={11} />}
          </span>
          <span>{t(`signup.${LABELS[rule.id]}`)}</span>
          <span className="sr-only">
            {' '}
            ({t(rule.met ? 'signup.ruleMet' : 'signup.rulePending')})
          </span>
        </li>
      ))}
    </ul>
  );
}
