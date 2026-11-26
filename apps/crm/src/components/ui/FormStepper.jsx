import React, { useEffect, useRef } from 'react';
import { OverflowList } from './OverflowList.jsx';

/** The form's steps; the current one scrolls into view when the chips overflow sideways. */
export function FormStepper({ steps, activeStep, accessibleStep, disabled, onSelect }) {
  const navRef = useRef(null);
  useEffect(() => {
    const current = navRef.current?.querySelector('[aria-current="step"]');
    const list = current?.closest('.overflow-list-scroll');
    if (!list) return;
    const box = current.getBoundingClientRect();
    const view = list.getBoundingClientRect();
    if (box.left < view.left) list.scrollLeft -= view.left - box.left + 8;
    else if (box.right > view.right) list.scrollLeft += box.right - view.right + 8;
  }, [activeStep]);
  return (
    <nav className="form-stepper" aria-label="Form steps" ref={navRef}>
      <p className="form-progress" role="status">
        Step {activeStep + 1} of {steps.length} · <strong>{steps[activeStep].title}</strong>
      </p>
      <OverflowList
        mode="scroll"
        items={steps}
        getKey={(step) => step.id}
        activeKey={steps[activeStep].id}
        label="Form section choices"
        listTag="ol"
        className="form-step-overflow"
        listClassName="form-step-list"
        listStyle={{
          '--form-step-count': steps.length,
        }}
        renderItem={(step, index, { close }) => (
          <button
            type="button"
            aria-label={`Step ${index + 1}: ${step.title}`}
            aria-current={index === activeStep ? 'step' : undefined}
            data-state={index < activeStep ? 'done' : undefined}
            disabled={disabled || index > accessibleStep}
            onClick={() => {
              onSelect(index);
              close();
            }}
          >
            <span className="form-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="form-step-label">{step.title}</span>
          </button>
        )}
      />
    </nav>
  );
}
