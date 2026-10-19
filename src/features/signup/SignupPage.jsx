import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { useI18n } from '../../i18n/useI18n.js';
import { DetailsStep } from './DetailsStep.jsx';
import { SetupStep } from './SetupStep.jsx';
import './signup.css';
import { bidiIsolate } from './signupModel.js';
import { SignupProgress } from './SignupProgress.jsx';
import { SignupShell } from './SignupShell.jsx';
import { SignupState } from './SignupState.jsx';
import { useSignUpFlow } from './useSignUpFlow.js';
import { useSignupStatus } from './useSignupStatus.js';
import { VerifyStep } from './VerifyStep.jsx';

const STEP_TITLES = ['detailsTitle', 'verifyTitle'];

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
  useUnsavedChanges(flow.dirty, Boolean(flow.busy));
  useEffect(() => {
    if (flow.finished) navigate('/dashboard');
  }, [flow.finished, navigate]);
  useEffect(() => {
    if (!status.loading) heading.current?.focus();
  }, [flow.step, status.loading]);
  if (status.loading)
    return <SignupState title={t('signup.loadingTitle')} body={t('signup.loadingBody')} loading />;
  if (status.error)
    return (
      <SignupState
        title={t('signup.loadingTitle')}
        body={t('signupErrors.unavailable')}
        action={t('common.language.retry')}
        onAction={status.retry}
      />
    );
  if (!status.value?.enabled)
    return (
      <SignupState
        title={t('signup.offTitle')}
        body={t('signup.offBody')}
        action={t('signup.goSignIn')}
        onAction={() => navigate('/')}
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
    provider: status.value.botCheck?.provider,
    siteKey: status.value.botCheck?.siteKey,
    onToken: flow.setBotToken,
    resetKey: flow.botReset,
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
            status={status.value}
            bot={{ ...bot, action: 'signup_start' }}
            error={flow.error}
            busy={flow.busy === 'start'}
            onChange={flow.setDetail}
            onSubmit={flow.start}
            onSignIn={() => navigate('/')}
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
            mode={status.value.mode}
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
