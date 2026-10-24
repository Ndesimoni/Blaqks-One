import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { FormStepper } from '../../../components/ui/FormStepper.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { JoinProfileFields } from './JoinProfileFields.jsx';
import { JoinReview } from './JoinReview.jsx';
import { JoinTerms } from './JoinTerms.jsx';
import { agreed, emptyDraft, profilePayload, profileProblem } from './joinDraft.js';
import { useMarketplaceTerms } from './useMarketplace.js';

const STEPS = ['profile', 'commitments', 'terms', 'review'];

/**
 * Joining the marketplace (broker marketplace §2, packet MK1b): profile, four separate
 * commitments plus the publication consent, the terms in full, then a review. Nothing is sent
 * until the last button.
 */
export function MarketplaceJoin({ termsVersion, onChanged }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const terms = useMarketplaceTerms(termsVersion);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(emptyDraft);
  const [ticks, setTicks] = useState([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const value = terms.value;
  const problem = profileProblem(draft);
  const change = (patch) => setDraft((last) => ({ ...last, ...patch }));
  const tick = (index) =>
    setTicks((last) => {
      const next = [...last];
      next[index] = next[index] !== true;
      return next;
    });
  const join = async () => {
    setBusy(true);
    setError('');
    try {
      await api.joinMarketplace(user.workspaceId, {
        profile: profilePayload(draft),
        commitments: value.commitments.map((_, index) => ticks[index] === true),
        consent,
        termsVersion: value.version,
        termsDigest: value.digest,
      });
      onChanged();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  if (!started)
    return (
      <section className="market-card">
        <h3>{t('marketplaceJoin.join.title')}</h3>
        <p>{t('marketplaceJoin.join.text')}</p>
        <Button onClick={() => setStarted(true)} disabled={!value}>
          {t('marketplaceJoin.join.start')}
        </Button>
      </section>
    );
  if (!value)
    return (
      <section className="market-card">
        <p role="status">{t('marketplace.loading')}</p>
        {terms.error && (
          <>
            <p className="field-error" role="alert">
              {terms.error}
            </p>
            <Button onClick={terms.reload}>{t('marketplace.retry')}</Button>
          </>
        )}
      </section>
    );
  const steps = STEPS.map((id) => ({ id, title: t(`marketplaceJoin.join.step.${id}`) }));
  const canNext = step === 0 ? !problem : step === 1 ? agreed(ticks, consent) : true;
  return (
    <section className="market-card">
      <h3>{t('marketplaceJoin.join.title')}</h3>
      <FormStepper
        steps={steps}
        activeStep={step}
        accessibleStep={step}
        disabled={busy}
        onSelect={setStep}
      />
      <div className="market-join-body">
        {step === 0 && (
          <>
            <JoinProfileFields draft={draft} onChange={change} />
            {problem && (
              <p className="field-error" role="alert">
                {t(`marketplaceJoin.join.problem.${problem}`)}
              </p>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <JoinTerms
              part="commitments"
              terms={value}
              ticks={ticks}
              consent={consent}
              onTick={tick}
              onConsent={setConsent}
            />
            {!agreed(ticks, consent) && (
              <p className="market-hint">{t('marketplaceJoin.join.required')}</p>
            )}
          </>
        )}
        {step === 2 && (
          <JoinTerms
            part="terms"
            terms={value}
            ticks={ticks}
            consent={consent}
            onTick={tick}
            onConsent={setConsent}
          />
        )}
        {step === 3 && (
          <JoinReview draft={draft} terms={value} busy={busy} error={error} onJoin={join} />
        )}
      </div>
      {step < 3 && (
        <div className="market-actions">
          {step > 0 && (
            <Button variant="light" onClick={() => setStep(step - 1)} disabled={busy}>
              {t('marketplaceJoin.join.back')}
            </Button>
          )}
          <Button onClick={() => setStep(step + 1)} disabled={busy || !canNext}>
            {t('marketplaceJoin.join.next')}
          </Button>
        </div>
      )}
    </section>
  );
}
