import React from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import { FormStepper } from '../../../../components/ui/FormStepper.jsx';
import { useI18n } from '../../../../i18n/useI18n.js';
import { FinanceDialog } from '../../finance/FinanceDialog.jsx';
import { profileName } from './publishModel.js';
import { usePublishers } from './usePublishers.js';
import { usePublishFlow } from './usePublishFlow.js';
import { PublishPropertyStep } from './PublishPropertyStep.jsx';
import { PublishAgentStep } from './PublishAgentStep.jsx';
import { PublishPhotos } from './PublishPhotos.jsx';
import { PublishPlans } from './PublishPlans.jsx';
import { PublishDetailsStep } from './PublishDetailsStep.jsx';
import { PublishReviewStep } from './PublishReviewStep.jsx';
import '../../finance/finance-forms.css';
import './website-publish.css';
import './website-publish-media.css';

function StepBody({ flow, publishers, publications, k }) {
  if (flow.stepId === 'property')
    return <PublishPropertyStep flow={flow} publications={publications} />;
  if (!flow.entry) return <p className="website-publish-note is-warning">{k('unavailable')}</p>;
  if (flow.stepId === 'agent') return <PublishAgentStep flow={flow} publishers={publishers} />;
  if (flow.stepId === 'media')
    return (
      <>
        <PublishPhotos flow={flow} />
        <PublishPlans flow={flow} />
      </>
    );
  if (flow.stepId === 'details') return <PublishDetailsStep flow={flow} />;
  return <PublishReviewStep flow={flow} publishers={publishers} />;
}

/**
 * Publish (or republish) one property on the website: a wide, stepped dialog that is full
 * screen on phones. `entry` fixes the property (opened from its details panel); without it
 * the first step chooses one. `publication` preselects that row's agent and destination.
 * `onPublished(publication)` runs after the server accepts; `onStale` reloads the list.
 */
export function PublishDialog({
  entry,
  publication,
  publications,
  site,
  onClose,
  onPublished,
  onStale,
}) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websitePublish.${key}`, vars);
  const publishers = usePublishers(site);
  const flow = usePublishFlow({
    entry,
    publication,
    publications,
    publishers,
    done: { published: onPublished, stale: onStale },
  });
  const steps = flow.steps.map((id) => ({ id, title: k(`step.${id}`) }));
  const agent = publishers.profiles.find((profile) => profile.id === flow.draft.agentProfileId);
  const failure = flow.failure;
  const message = failure
    ? failure.key
      ? k(failure.key, { agent: profileName(agent) || k('thisAgent') })
      : failure.message
    : '';
  const waiting = publishers.loading || Boolean(publishers.error);
  const title = flow.entry?.record?.listing_title;
  return (
    <FinanceDialog
      wide
      eyebrow={k('eyebrow')}
      title={k(flow.existing ? 'republishTitle' : 'publishTitle')}
      intro={title ? k('introFor', { title }) : k('intro')}
      busy={flow.busy}
      message={message}
      onClose={onClose}
      onSubmit={flow.next}
      submitLabel={k(flow.stepId === 'review' ? 'publishNow' : 'next')}
      submitDisabled={waiting}
      secondary={flow.step > 0 ? { label: k('back'), onClick: flow.back } : null}
      className="website-publish-dialog"
    >
      <FormStepper
        steps={steps}
        activeStep={flow.step}
        accessibleStep={flow.reached}
        disabled={flow.busy}
        onSelect={flow.select}
      />
      <div className="website-publish-step" ref={flow.bodyRef}>
        <h3 className="form-heading form-step-title" tabIndex={-1} ref={flow.headingRef}>
          {steps[flow.step].title}
        </h3>
        {publishers.loading && (
          <div className="website-publish-loading" role="status">
            <span className="sr-only">{k('loading')}</span>
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </div>
        )}
        {!publishers.loading && publishers.error && (
          <div className="recovery-panel website-publish-error" role="alert">
            <p className="field-error">{publishers.error}</p>
            <Button variant="light" onClick={publishers.retry}>
              {k('retry')}
            </Button>
          </div>
        )}
        {!waiting && (
          <fieldset className="finance-fieldset website-publish-fields" disabled={flow.busy}>
            <legend className="sr-only">{steps[flow.step].title}</legend>
            <StepBody flow={flow} publishers={publishers} publications={publications} k={k} />
          </fieldset>
        )}
      </div>
    </FinanceDialog>
  );
}
