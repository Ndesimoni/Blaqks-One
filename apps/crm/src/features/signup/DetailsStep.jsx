import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { BotCheck } from './BotCheck.jsx';
import { SignupField } from './SignupField.jsx';
import { SignupPasswordRules } from './SignupPasswordRules.jsx';

export function DetailsStep({ values, status, bot, error, busy, onChange, onSubmit, onSignIn }) {
  const { t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);
  const refs = {
    name: useRef(),
    email: useRef(),
    phone: useRef(),
    password: useRef(),
    consent: useRef(),
  };
  useEffect(() => {
    if (error?.field) refs[error.field]?.current?.focus();
  }, [error]);
  const message = (field) => (error?.field === field ? t(error.key) : '');
  return (
    <form
      className="signup-details"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <p>{t('signup.detailsBody')}</p>
      <SignupField id="signup-name" label={t('signup.fullName')} error={message('name')}>
        <input
          ref={refs.name}
          autoComplete="name"
          value={values.name}
          disabled={busy}
          onChange={(event) => onChange('name', event.target.value)}
        />
      </SignupField>
      <SignupField id="signup-email" label={t('signup.email')} error={message('email')}>
        <input
          ref={refs.email}
          className="u-ltr"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          value={values.email}
          disabled={busy}
          onChange={(event) => onChange('email', event.target.value)}
        />
      </SignupField>
      <SignupField
        id="signup-phone"
        label={t('signup.mobile')}
        hint={t('signup.mobileHint')}
        error={message('phone')}
      >
        <input
          ref={refs.phone}
          className="u-ltr"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={values.phone}
          disabled={busy}
          onChange={(event) => onChange('phone', event.target.value)}
        />
      </SignupField>
      <div className="field signup-field">
        <label htmlFor="signup-password">{t('signup.password')}</label>
        <span className="signup-password">
          <input
            id="signup-password"
            ref={refs.password}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={values.password}
            disabled={busy}
            aria-invalid={Boolean(message('password'))}
            aria-describedby={`signup-password-rules${
              message('password') ? ' signup-password-error' : ''
            }`}
            onChange={(event) => onChange('password', event.target.value)}
          />
          <button type="button" disabled={busy} onClick={() => setShowPassword((value) => !value)}>
            {t(showPassword ? 'signup.hidePassword' : 'signup.showPassword')}
          </button>
        </span>
        {message('password') && (
          <small id="signup-password-error" className="field-error" role="alert">
            {message('password')}
          </small>
        )}
      </div>
      <SignupPasswordRules
        id="signup-password-rules"
        password={values.password}
        email={values.email}
      />
      <label className="signup-consent">
        <input
          ref={refs.consent}
          type="checkbox"
          checked={values.consent}
          disabled={busy}
          aria-invalid={Boolean(message('consent'))}
          aria-describedby={message('consent') ? 'signup-consent-error' : undefined}
          onChange={(event) => onChange('consent', event.target.checked)}
        />
        <span>{t('signup.consent')}</span>
      </label>
      {message('consent') && (
        <p id="signup-consent-error" className="field-error" role="alert">
          {message('consent')}
        </p>
      )}
      <div className="signup-legal-links">
        <a href={status.terms.url} target="_blank" rel="noreferrer">
          {t('signup.readTerms')}
        </a>
        <a href={status.privacy.url} target="_blank" rel="noreferrer">
          {t('signup.readPrivacy')}
        </a>
      </div>
      <BotCheck {...bot} />
      {!error?.field && error && (
        <p className="field-error" role="alert">
          {t(error.key)}
        </p>
      )}
      <Button className="signup-primary" type="submit" disabled={busy || !bot.ready}>
        {t(busy ? 'signup.sendingCode' : 'signup.sendCode')}
      </Button>
      <button className="signup-text-action" type="button" onClick={onSignIn}>
        {t('signup.haveAccount')}
      </button>
    </form>
  );
}
