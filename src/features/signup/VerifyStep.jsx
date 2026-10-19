import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { bidiIsolate } from './signupModel.js';

export function VerifyStep({
  request,
  code,
  seconds,
  error,
  busy,
  onCode,
  onVerify,
  onResend,
  onDifferent,
  mode,
}) {
  const { t } = useI18n();
  const input = useRef(null);
  const [announced, setAnnounced] = useState(false);
  useEffect(() => {
    if (error?.field === 'code') input.current?.focus();
  }, [error]);
  useEffect(() => {
    if (seconds > 0) setAnnounced(false);
    if (seconds === 0 && !announced) setAnnounced(true);
  }, [seconds, announced]);
  const resend = async () => {
    await onResend();
    input.current?.focus();
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onVerify();
      }}
    >
      <p>{t('signup.verifyBody', { email: bidiIsolate(request.maskedEmail) })}</p>
      {mode === 'local' && (
        <p className="signup-local-note" role="note">
          {t('signup.localNotice')}
        </p>
      )}
      <div className="field signup-code-field">
        <label htmlFor="signup-code">{t('signup.codeLabel')}</label>
        <input
          ref={input}
          id="signup-code"
          className="u-ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          disabled={Boolean(busy)}
          aria-invalid={error?.field === 'code'}
          aria-describedby={error?.field === 'code' ? 'signup-code-error' : undefined}
          onChange={(event) => onCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </div>
      {error && (
        <p id="signup-code-error" className="field-error" role="alert">
          {t(error.key)}
        </p>
      )}
      <Button className="signup-primary" type="submit" disabled={Boolean(busy)}>
        {t(busy === 'verify' ? 'signup.verifying' : 'signup.verifyCreate')}
      </Button>
      <div className="signup-verify-actions">
        {request.sends >= 5 ? (
          <button type="button" className="signup-text-action" onClick={onDifferent}>
            {t('signup.startAgain')}
          </button>
        ) : seconds > 0 ? (
          <span>{t('signup.resendIn', { seconds })}</span>
        ) : (
          <button
            type="button"
            className="signup-text-action"
            disabled={Boolean(busy)}
            onClick={resend}
          >
            {t(busy === 'resend' ? 'signup.resending' : 'signup.resend')}
          </button>
        )}
        <button type="button" className="signup-text-action" onClick={onDifferent}>
          {t('signup.differentEmail')}
        </button>
      </div>
      {announced && (
        <span className="sr-only" role="status">
          {t('signup.resendReady')}
        </span>
      )}
    </form>
  );
}
