import { useRef, useState } from 'react';
import { useFinanceContext } from './useFinanceRequests.js';
import { reasonError, reasonMessage } from './financeRules.js';
import { failureText } from './FinanceDialog.jsx';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Shared payment/expense form state (finance-design §4, §7). Validation runs before any
 * request and focuses the first invalid field; a refusal, 403, 404 or 409 keeps the draft.
 * Editing a rejected row resubmits it; an Admin edit of an approved row needs a reason.
 * `latest` is the row as the overview now holds it, so a retry after a conflict uses the
 * refreshed version while the typed entries stay.
 */
export function useEntryForm({ kind, latest, initial, validate, onDone, onClose }) {
  const { actions } = useFinanceContext();
  const [start] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState({});
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const formRef = useRef(null);
  const needsReason = latest?.status === 'approved';
  const change = (key, value) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => (previous[key] ? { ...previous, [key]: '' } : previous));
  };
  const focusFirst = () =>
    requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
  const submit = async () => {
    if (actions.busy) return;
    setMessage('');
    const checked = validate(draft);
    const reasonFailure = needsReason ? reasonError(reason) : '';
    if (!checked.body || reasonFailure) {
      setErrors({ ...checked.errors, ...(reasonFailure && { reason: reasonMessage }) });
      return focusFirst();
    }
    setErrors({});
    const result = await actions.saveEntry(
      kind,
      checked.body,
      latest,
      needsReason ? reason : undefined,
    );
    if (result.ok) return onDone(result.result);
    setErrors(result.errors ?? {});
    setMessage(failureText(result, 'record'));
  };
  const requestClose = () => {
    if (actions.busy) return;
    const changed = !same(draft, start) || Boolean(reason.trim());
    if (changed && !confirm('Discard your unsaved changes?')) return;
    onClose();
  };
  return {
    draft,
    change,
    bind: (key) => ({
      value: draft[key],
      onChange: (event) => change(key, event.target.value),
    }),
    errors,
    reason,
    setReason,
    needsReason,
    message,
    busy: actions.busy,
    formRef,
    submit,
    requestClose,
  };
}

/** Title, intro and submit label for create, resubmit, pending edit and Admin edits. */
export function entryFormText(kindWords, latest) {
  if (!latest)
    return {
      title: kindWords.add,
      submit: kindWords.noun === 'payment' ? 'Submit payment' : 'Submit expense',
      intro: 'It is saved as Pending approval until an approver reviews it.',
    };
  if (latest.status === 'rejected')
    return {
      title: 'Correct and resubmit',
      submit: 'Resubmit',
      intro: 'Saving sends it back for approval as Pending approval.',
    };
  if (latest.status === 'approved')
    return {
      title: `Edit approved ${kindWords.noun}`,
      submit: 'Save changes',
      intro: 'Approved records are changed by your Admin only, with a reason kept in history.',
    };
  return { title: `Edit ${kindWords.noun}`, submit: 'Save changes', intro: null };
}
