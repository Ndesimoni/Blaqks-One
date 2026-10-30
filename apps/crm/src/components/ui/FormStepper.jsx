import React from 'react';
import { OverflowList } from './OverflowList.jsx';

export function FormStepper({ steps, activeStep, accessibleStep, disabled, onSelect }) {
  return (
    <nav className="form-stepper" aria-label="Form steps">
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
