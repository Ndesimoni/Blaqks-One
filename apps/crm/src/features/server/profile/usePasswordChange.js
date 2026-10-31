import { useCallback, useRef, useState } from 'react';
import { meetsPasswordPolicy, weakPasswordMessage } from '../../../lib/passwordPolicy.js';

const empty = { current: '', next: '', confirm: '' };

/** Client-side checks first; the first failing field receives the error. */
function validate(values, email) {
  if (!values.current) return { field: 'current', message: 'Enter your current password.' };
  if (!meetsPasswordPolicy(values.next, { current: values.current, email }))
    return { field: 'next', message: weakPasswordMessage };
  if (values.next !== values.confirm)
    return { field: 'confirm', message: 'Enter the same new password twice.' };
  return null;
}

/**
 * Password-change state. Values live only in this component state: they are cleared after every
 * response and disappear on unmount, and are never put in context, storage, the URL or logs.
 */
export function usePasswordChange(api, email, onChanged) {
  const [values, setValues] = useState(empty);
  const [error, setError] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const set = useCallback((field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setError((current) => (current?.field === field ? null : current));
  }, []);
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current) return null;
    const invalid = validate(values, email);
    setOutcome(null);
    setError(invalid);
    if (invalid) return invalid.field;
    pending.current = true;
    setBusy(true);
    try {
      await api.changePassword(values.current, values.next);
      setOutcome({ kind: 'success', message: 'Password changed. Other devices were signed out.' });
      onChanged();
      return null;
    } catch (failure) {
      const code = failure.details?.code;
      if (code === 'invalid_current_password') {
        setError({ field: 'current', message: failure.message });
        return 'current';
      }
      if (code === 'weak_password') {
        setError({ field: 'next', message: failure.message });
        return 'next';
      }
      const kind = failure.status === 409 ? 'stale' : 'alert';
      setOutcome({ kind, message: failure.message });
      return null;
    } finally {
      setValues(empty);
      pending.current = false;
      setBusy(false);
    }
  };
  const dirty = Boolean(values.current || values.next || values.confirm);
  return { values, set, error, outcome, busy, dirty, submit };
}
