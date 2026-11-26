import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { useI18n } from '../../i18n/useI18n.js';
import { SIGN_IN, isSignUpPath } from '../auth/authPaths.js';
import { DetailsStep } from './DetailsStep.jsx';
import { SetupStep } from './SetupStep.jsx';
import './signup.css';
import { bidiIsolate } from './signupModel.js';
import { SignupProgress } from './SignupProgress.jsx';
import { SignupShell } from './SignupShell.jsx';
import { SignupState } from './SignupState.jsx';
import { useSignupAddress } from './useSignupAddress.js';
import { useSignUpFlow } from './useSignUpFlow.js';
import { useSignupStatus } from './useSignupStatus.js';
import { VerifyStep } from './VerifyStep.jsx';

const STEP_TITLES = ['detailsTitle', 'verifyTitle'];
const PENDING = { enabled: true, terms: {}, privacy: {}, botCheck: null, mode: '' };

/**
 * Sign-up's three steps, each its own full-screen page (owner, 2026-11-05): your details at
 * /sign-up, email verification at /sign-up/verify and the company at /sign-up/company, then
 * the start page and its tour (useSignupAddress keeps the address and the step together).
 */
export function SignupPage({ api, user, onVerified, onSignOut }) {
  const { language, t } = useI18n();
  const navigate = useNavigate();
  const heading = useRef(null);
  const [createdHere, setCreatedHere] = useState(false);
  const status = useSignupStatus(api);
  const verified = (profile) => {
    setCreatedHere(true);
    onVerified(profile);
  };
  const flow = useSignUpFlow({
    api,
    status: status.value,
    language,
    onVerified: verified,
  });
  useUnsavedChanges(flow.dirty, Boolean(flow.busy), '', isSignUpPath);
  useEffect(() => heading.current?.focus(), [flow.step]);
  useSignupAddress(flow);
  // The form shows at once; Continue waits for the server's sign-up settings.
  const info = status.value ?? PENDING;
  if (status.error)
    return (
      <SignupState
        title={t('signup.loadingTitle')}
        body={t('signupErrors.unavailable')}
        action={t('common.language.retry')}
        onAction={status.retry}
      />
    );
  if (!status.loading && !info.enabled)
    return (
      <SignupState
        title={t('signup.offTitle')}
        body={t('signup.offBody')}
        action={t('signup.goSignIn')}
        onAction={() => navigate(SIGN_IN)}
      />
    );
  if (user && !createdHere)
    return (
      <SignupState
        title={t('signup.signedInTitle')}
        body={t('signup.signedInBody', { email: bidiIsolate(user.email) })}
        action={t('signup.signOutCreate')}
        onAction={onSignOut}
      />
    );
  const title =
    flow.step === 3 ? t('signupSetup.brokerageTitle') : t(`signup.${STEP_TITLES[flow.step - 1]}`);
  const bot = {
    provider: info.botCheck?.provider,
    siteKey: info.botCheck?.siteKey,
    onToken: flow.setBotToken,
    resetKey: flow.botReset,
    ready: flow.botReady && Boolean(status.value),
  };
  return (
    <SignupShell>
      {flow.step > 1 && flow.step < 3 && (
        <button type="button" className="signup-back" onClick={flow.back}>
          <span className="u-mirror-rtl" aria-hidden="true">
            ‹
          </span>{' '}
          {t('signup.back')}
        </button>
      )}
      <SignupProgress step={flow.step} />
      <div className="signup-step" key={flow.step}>
        <h1 ref={heading} tabIndex="-1">
          {title}
        </h1>
        {flow.step === 1 && (
          <DetailsStep
            values={flow.details}
            status={info}
            bot={{ ...bot, action: 'signup_start' }}
            error={flow.error}
            busy={flow.busy === 'start'}
            onChange={flow.setDetail}
            onSubmit={flow.start}
            onSignIn={() => navigate(SIGN_IN)}
          />
        )}
        {flow.step === 2 && (
          <VerifyStep
            request={flow.request}
            code={flow.code}
            seconds={flow.seconds}
            error={flow.error}
            busy={flow.busy}
            onCode={(value) => {
              flow.setCode(value);
              flow.setError(null);
            }}
            onVerify={flow.verify}
            onResend={flow.resend}
            onDifferent={flow.differentEmail}
            bot={{ ...bot, action: 'signup_resend' }}
            mode={info.mode}
          />
        )}
        {flow.step === 3 && (
          <SetupStep
            values={flow.setup}
            error={flow.error}
            busy={flow.busy === 'setup'}
            onChange={flow.setSetup}
            onSave={flow.saveSetup}
          />
        )}
      </div>
    </SignupShell>
  );
}
