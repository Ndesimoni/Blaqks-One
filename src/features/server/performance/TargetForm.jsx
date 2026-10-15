import React, { useEffect, useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { draftText, parseTargetDraft } from './targetsModel.js';

/**
 * Admin-only target editor for one measure. Blank saves clear the target. The draft is kept
 * after a failed save so nothing typed is lost; the server's message explains the refusal.
 */
export function TargetForm({ metric, target, onSave }) {
  const id = useId();
  const saved = draftText(metric.key, target?.value);
  const [draft, setDraft] = useState(saved);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setDraft(saved);
    setError('');
  }, [saved]);
  const submit = async (event) => {
    event.preventDefault();
    const parsed = parseTargetDraft(metric.key, draft);
    if (parsed.error) return setError(parsed.error);
    setSaving(true);
    setError('');
    try {
      await onSave({ metric: metric.key, value: parsed.value, version: target?.version ?? null });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSaving(false);
    }
    return undefined;
  };
  return (
    <form className="target-form" onSubmit={submit} noValidate>
      <label htmlFor={id}>{metric.money ? 'Target (AED)' : 'Target'}</label>
      <input
        id={id}
        inputMode={metric.money ? 'decimal' : 'numeric'}
        aria-label={`Target for ${metric.label}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder="No target"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button type="submit" variant="light" disabled={saving || draft.trim() === saved}>
        {saving ? 'Saving…' : 'Save target'}
      </Button>
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
