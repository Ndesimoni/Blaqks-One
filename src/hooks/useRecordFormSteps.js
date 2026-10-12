import { useEffect, useMemo, useRef, useState } from 'react';
import { errorSectionIndex, recordFormSections } from '../features/records/formSections.js';
import { validateRecord, validateRecordSection } from '../features/records/validation.js';

export function useRecordFormSteps({
  module,
  form,
  records,
  original,
  initialSection,
  busy,
  data,
  idOptional = false,
}) {
  const rules = { idOptional };
  const sections = useMemo(() => recordFormSections(module), [module]);
  const multiStep = sections.length > 1;
  const steps = useMemo(
    () => (multiStep ? [...sections, { id: 'review', title: 'Review & save' }] : sections),
    [sections, multiStep],
  );
  const [activeStep, setActiveStep] = useState(() =>
    original
      ? Math.max(
          0,
          sections.findIndex((section) => section.id === initialSection),
        )
      : 0,
  );
  const [furthestStep, setFurthestStep] = useState(activeStep);
  const [errors, setErrors] = useState({});
  const bodyRef = useRef(null);
  const headingRef = useRef(null);
  const previousStep = useRef(activeStep);
  const focusKey = useRef(null);
  const accessibleStep = original ? steps.length - 1 : furthestStep;
  const review = multiStep && activeStep === sections.length;

  useEffect(() => {
    if (previousStep.current === activeStep) return;
    previousStep.current = activeStep;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    const target = focusKey.current
      ? document.getElementById(focusKey.current)
      : headingRef.current;
    target?.focus();
    focusKey.current = null;
  }, [activeStep]);

  const reportErrors = (validation) => {
    setErrors(validation);
    const targetStep = errorSectionIndex(sections, validation);
    if (targetStep < 0) return;
    const key = sections[targetStep].fields.find((field) => validation[field.key]).key;
    if (targetStep === activeStep) document.getElementById(key)?.focus();
    else {
      focusKey.current = key;
      setActiveStep(targetStep);
    }
  };
  const validateCurrent = () => {
    if (review) return true;
    const fields = sections[activeStep].fields;
    const validation = validateRecordSection(module, form, records, original, fields, data, rules);
    setErrors((previous) => {
      const next = { ...previous };
      fields.forEach((field) => delete next[field.key]);
      return { ...next, ...validation };
    });
    const first = fields.find((field) => validation[field.key]);
    if (first) document.getElementById(first.key)?.focus();
    return !first;
  };
  const moveTo = (index) => {
    setActiveStep(index);
    setFurthestStep((previous) => Math.max(previous, index));
  };
  const next = () => {
    if (busy || activeStep >= steps.length - 1 || !validateCurrent()) return;
    moveTo(activeStep + 1);
  };
  const selectStep = (index) => {
    if (busy || index < 0 || index > accessibleStep || index === activeStep) return;
    if (index > activeStep && !validateCurrent()) return;
    moveTo(index);
  };
  const validateAll = () => {
    const validation = validateRecord(module, form, records, original, data, rules);
    reportErrors(validation);
    return !Object.keys(validation).length;
  };

  return {
    sections,
    steps,
    activeStep,
    accessibleStep,
    multiStep,
    review,
    errors,
    setErrors,
    bodyRef,
    headingRef,
    next,
    selectStep,
    validateAll,
    reportErrors,
  };
}
