import { useRef, useState } from 'react';
import {
  dealBodyFromDraft,
  dealSteps,
  draftChanged,
  draftFromDeal,
  stepErrors,
} from './dealDraft.js';

const fieldOrder = dealSteps.flatMap((step) => step.fields);

/**
 * Deal editor state (finance-design §7): Parties → Value & fee → Pipeline → Review. Each step
 * validates before advancing and moving back keeps every entry. A refused or failed save
 * keeps the whole draft; a version conflict offers to reload the latest saved deal.
 */
export function useDealEditor({ deal, latest, actions, onDone, onClose }) {
  const [base, setBase] = useState(deal);
  const [initial, setInitial] = useState(() => draftFromDeal(deal));
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const bodyRef = useRef(null);
  const headingRef = useRef(null);
  const focusHeading = () => requestAnimationFrame(() => headingRef.current?.focus());
  const busy = actions.busy;
  const review = dealSteps[step].id === 'review';

  const focusFirst = (found) => {
    const key = fieldOrder.find((name) => found[name]);
    requestAnimationFrame(() => bodyRef.current?.querySelector(`[name="${key}"]`)?.focus());
  };
  const change = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: '' }));
  };
  const changeDetail = (key, value) =>
    setForm((previous) => ({ ...previous, details: { ...previous.details, [key]: value } }));
  const select = (index) => {
    if (busy || index > reached) return;
    setStep(index);
    setMessage('');
    focusHeading();
  };
  const next = () => {
    const found = stepErrors(form, dealSteps[step].id);
    setErrors(found);
    if (Object.keys(found).length) return focusFirst(found);
    const following = Math.min(step + 1, dealSteps.length - 1);
    setStep(following);
    setReached((previous) => Math.max(previous, following));
    focusHeading();
  };
  const save = async () => {
    const { body, errors: found } = dealBodyFromDraft(form);
    if (!body) {
      setErrors(found);
      const owner = dealSteps.findIndex((item) => item.fields.some((key) => found[key]));
      setStep(Math.max(0, owner));
      return focusFirst(found);
    }
    setMessage('');
    const result = await actions.saveDeal(body, base);
    if (result.ok) return onDone(result.result);
    setMessage(result.message || 'The deal could not be saved. Your draft is still here.');
    setConflict(result.conflict);
  };
  const submit = () => (review ? save() : next());
  const requestClose = () => {
    if (busy) return;
    if (draftChanged(form, initial) && !confirm('Discard your unsaved changes?')) return;
    onClose();
  };
  const reload = () => {
    if (!latest || !confirm('Replace this draft with the latest saved deal?')) return;
    const fresh = draftFromDeal(latest);
    setBase(latest);
    setInitial(fresh);
    setForm(fresh);
    setConflict(false);
    setMessage('');
  };
  return {
    form,
    step,
    reached,
    review,
    errors,
    message,
    conflict,
    busy,
    bodyRef,
    headingRef,
    change,
    changeDetail,
    select,
    back: () => select(step - 1),
    submit,
    requestClose,
    reload,
  };
}
