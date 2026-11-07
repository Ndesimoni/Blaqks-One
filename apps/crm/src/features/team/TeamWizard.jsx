import React, { useEffect, useId, useRef, useState } from 'react';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { FormStepper } from '../../components/ui/FormStepper.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';

export function TeamWizard({
  title,
  subtitle,
  initial,
  steps,
  finishLabel,
  onFinish,
  onSuccess,
  onClose,
  modal = true,
  eyebrow = 'TEAM & ACCESS · FRONTEND PREVIEW',
}) {
  const [form, setForm] = useState(initial);
  const [active, setActive] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const resultRef = useRef(null);
  const formRef = useRef(null);
  const headingRef = useRef(null);
  const bodyRef = useRef(null);
  const previousStep = useRef(active);
  const id = useId();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedChanges(!finished && dirty, busy);
  useEffect(() => {
    if (previousStep.current !== active) {
      previousStep.current = active;
      headingRef.current?.focus();
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
    }
  }, [active]);
  useEffect(() => {
    if (Object.keys(errors).length)
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [errors]);
  useEffect(() => {
    if (finished) onSuccess(resultRef.current);
  }, [finished, onSuccess]);
  const change = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: '' }));
    setFailure('');
  };
  const close = () => {
    if (!busy && (!dirty || finished || confirm('Discard your unsaved changes?'))) onClose?.();
  };
  const validate = (index) => {
    const validation = steps[index].validate?.(form) || {};
    setErrors(validation);
    return !Object.keys(validation).length;
  };
  const go = (index) => {
    if (busy || index > furthest || (index > active && !validate(active))) return;
    setActive(index);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy || !validate(active)) return;
    if (active < steps.length - 1) {
      setActive(active + 1);
      setFurthest(Math.max(furthest, active + 1));
      return;
    }
    for (let index = 0; index < steps.length; index++) {
      if (!validate(index)) {
        setActive(index);
        return;
      }
    }
    setBusy(true);
    setFailure('');
    try {
      resultRef.current = await onFinish(form);
      setFinished(true);
    } catch (error) {
      setFailure(error.message);
      if (error.fields) setErrors(error.fields);
    } finally {
      setBusy(false);
    }
  };
  const content = (
    <>
      <div className="drawer-top">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 id={id}>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {onClose && (
          <button
            className="icon-btn"
            type="button"
            aria-label={`Close ${title.toLowerCase()}`}
            onClick={close}
            disabled={busy}
          >
            <Icon name="close" size={20} />
          </button>
        )}
      </div>
      <form noValidate onSubmit={submit} className="drawer-form team-wizard" ref={formRef}>
        <FormStepper
          steps={steps}
          activeStep={active}
          accessibleStep={furthest}
          disabled={busy}
          onSelect={go}
        />
        <div className="drawer-body" ref={bodyRef}>
          <h3 className="form-heading form-step-title" tabIndex={-1} ref={headingRef}>
            {String(active + 1).padStart(2, '0')} · {steps[active].title}
          </h3>
          {failure && (
            <p className="field-error" role="alert">
              {failure}
            </p>
          )}
          {steps[active].render({ form, change, errors })}
        </div>
        <div className="drawer-footer">
          {onClose ? (
            <Button variant="light" onClick={close} disabled={busy}>
              Cancel
            </Button>
          ) : (
            <span className="team-preview-label">Preview only</span>
          )}
          <div className="form-step-actions">
            {active > 0 && (
              <Button variant="light" disabled={busy} onClick={() => go(active - 1)}>
                Back
              </Button>
            )}
            <Button
              type="submit"
              disabled={busy}
              icon={active === steps.length - 1 ? 'check' : 'arrow'}
            >
              {busy ? 'Saving…' : active === steps.length - 1 ? finishLabel : 'Next'}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
  return modal ? (
    <Drawer className="editor-drawer wizard-editor team-wizard-dialog" titleId={id} onClose={close}>
      {content}
    </Drawer>
  ) : (
    <div className="team-standalone-wizard">{content}</div>
  );
}
