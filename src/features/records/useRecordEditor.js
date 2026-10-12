import { useMemo, useRef, useState } from 'react';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { useRecordFormSteps } from '../../hooks/useRecordFormSteps.js';

export function useRecordEditor({ drawer, data, onClose, onSave, onReload }) {
  const { module, original } = drawer;
  const [form, setForm] = useState({ ...drawer.record });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [conflict, setConflict] = useState(false);
  const savingRef = useRef(false);
  const busy = uploading || saving;
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(drawer.record),
    [form, drawer.record],
  );
  useUnsavedChanges(dirty, busy);
  const steps = useRecordFormSteps({
    module,
    form,
    records: data[module],
    original,
    initialSection: drawer.initialSection,
    busy,
    data,
  });
  const change = (key, value) => {
    steps.setErrors((previous) => ({ ...previous, [key]: '' }));
    setSaveError('');
    setForm((previous) => ({
      ...previous,
      [key]: value,
      ...(module === 'Follow-ups' && key === 'calendar_start' && value
        ? { due_date: value.slice(0, 10) }
        : {}),
      ...(module === 'Properties' && key === 'sale_rental'
        ? {
            price_basis:
              value === 'Holiday home' ? 'Nightly' : value === 'Rental' ? 'Annual' : 'Total price',
          }
        : {}),
    }));
  };
  const requestClose = () => {
    if (busy || savingRef.current) return;
    if (dirty && !confirm('Discard your unsaved changes?')) return;
    onClose();
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy || savingRef.current) return;
    if (steps.multiStep && !steps.review) {
      steps.next();
      return;
    }
    if (!steps.validateAll()) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await onSave(module, form, original);
      if (!result?.workspace) {
        steps.reportErrors(result?.errors || {});
        setSaveError(result?.message || 'Check the highlighted fields.');
        setConflict(Boolean(result?.conflict));
      }
    } catch (error) {
      setSaveError(error.message || 'Changes could not be saved. Your draft is still here.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const reload = async () => {
    if (busy || savingRef.current) return;
    if (!confirm('Replace this draft with the latest saved record?')) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onReload(module, original);
    } catch (error) {
      setSaveError(error.message || 'The latest record could not be loaded.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return {
    ...steps,
    form,
    setForm,
    uploading,
    setUploading,
    saving,
    busy,
    saveError,
    conflict,
    change,
    requestClose,
    submit,
    reload,
  };
}
