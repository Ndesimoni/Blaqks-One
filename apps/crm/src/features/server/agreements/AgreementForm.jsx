import React, { useId } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { FormStepper } from '../../../components/ui/FormStepper.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { shareOther } from './agreementDraft.js';
import { FormMoney } from './FormMoney.jsx';
import { FormParties } from './FormParties.jsx';
import { FormReview } from './FormReview.jsx';
import { FormSubject } from './FormSubject.jsx';
import { useAgreementForm } from './useAgreementForm.js';

const STEP_VIEWS = {
  parties: FormParties,
  subject: FormSubject,
  money: FormMoney,
  review: FormReview,
};

/** Both sides' names: the caller and the found recipient, or the agreement's parties. */
function sideNames(mode, detail, user, recipient) {
  if (mode === 'create') return { sender: user.name, recipient: recipient?.name };
  if (mode === 'share') return { sender: user.name, recipient: shareOther(detail, user).name };
  return {
    sender: detail.agreement.parties?.sender?.name,
    recipient: detail.agreement.parties?.recipient?.name,
  };
}

/**
 * New agreement, draft revision or counter-offer (docs/agreements-design.md §3, §6): a
 * stepped form whose last step previews exactly the terms that will be frozen into the
 * new revision. Closing with entries asks first; refusals keep every entry.
 */
export function AgreementForm({ mode, detail, onClose, onSaved }) {
  const { api, user } = useSession();
  const { t } = useI18n();
  const titleId = useId();
  const form = useAgreementForm({
    api,
    workspaceId: user.workspaceId,
    mode,
    detail,
    onSaved,
    discardMessage: t('agreementForm.discard'),
  });
  const close = () => {
    if (form.saving) return;
    if (!form.dirty || confirm(t('agreementForm.discard'))) onClose();
  };
  const last = form.step === form.steps.length - 1;
  const View = STEP_VIEWS[form.name];
  const names = sideNames(mode, detail, user, form.recipient);
  const first = mode === 'create' || mode === 'share';
  const number = first ? 1 : detail.revision.number + 1;
  return (
    <Drawer
      className="agreement-dialog agreement-form"
      size="wide"
      titleId={titleId}
      onClose={close}
    >
      <div className="drawer-top">
        <div>
          <div className="eyebrow">
            {first
              ? t('agreementForm.eyebrow.create')
              : t('agreementForm.eyebrow.revision', { number })}
          </div>
          <h2 id={titleId} tabIndex={-1} data-initial-focus>
            {t(`agreementForm.title.${mode}`)}
          </h2>
          <p>{t(`agreementForm.intro.${mode}`, { name: names.recipient || '' })}</p>
        </div>
        <button
          className="icon-btn"
          aria-label={t('agreementForm.close')}
          disabled={form.saving}
          onClick={close}
        >
          <Icon name="close" size={21} />
        </button>
      </div>
      <FormStepper
        steps={form.steps.map((id) => ({ id, title: t(`agreementForm.step.${id}`) }))}
        activeStep={form.step}
        accessibleStep={form.reached}
        disabled={form.saving}
        onSelect={form.goTo}
      />
      <form
        ref={form.formRef}
        className="drawer-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (last) form.submit();
          else form.next();
        }}
      >
        <div className="drawer-body agreement-body">
          <View form={form} mode={mode} detail={detail} names={names} number={number} />
          {form.failure && (
            <div className="agreement-notice is-error" role="alert">
              <Icon name="info" size={18} />
              <p>{form.failure.key ? t(form.failure.key) : form.failure.message}</p>
            </div>
          )}
        </div>
        <div className="drawer-footer">
          <Button variant="light" disabled={form.saving} onClick={close}>
            {t('agreementForm.cancel')}
          </Button>
          {form.step > 0 && (
            <Button variant="light" disabled={form.saving} onClick={form.back}>
              {t('agreementForm.back')}
            </Button>
          )}
          <Button type="submit" disabled={form.saving || (last && !form.terms)}>
            {form.saving
              ? t('agreementForm.saving')
              : last
                ? t(`agreementForm.save.${mode}`)
                : t('agreementForm.next')}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
